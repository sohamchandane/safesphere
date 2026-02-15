from fastapi import FastAPI, HTTPException, Header, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import joblib
import numpy as np
import pandas as pd
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from the root .env file
# load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

app = FastAPI(title="Asthma Risk Prediction API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATHS = [
    os.path.join(os.path.dirname(__file__), "model", "bagging_model.joblib"),
    os.path.join(os.path.dirname(__file__), "..", "public", "bagging_model.joblib"),
    os.path.join(os.path.dirname(__file__), "..", "bagging_model.joblib"),
]

artifact = None
for p in MODEL_PATHS:
    try:
        if os.path.exists(p):
            artifact = joblib.load(p)
            print(f"Loaded model from {p}")
            break
    except Exception as e:
        print(f"Could not load model from {p}: {e}")

if artifact is None:
    print("WARNING: No model artifact found. /predict will return 500 until the model is available.")
else:
    try:
        fn = artifact.get('feature_names') if isinstance(artifact, dict) else None
        print(f"Model feature_names: {fn}")
    except Exception as e:
        print(f"Could not read feature_names from artifact: {e}")

# artifact expected to be { 'pipeline': Pipeline, 'feature_names': [...] }

class PredictRequest(BaseModel):
    features: dict
    email: str | None = None
    username: str | None = None


def canonical_name(s: str | None) -> str:
    """Normalize a feature name for robust matching: lowercase + remove non-alphanumeric."""
    if s is None:
        return ""
    return ''.join(ch.lower() for ch in str(s) if ch.isalnum())

def auth_ok(x_api_key: str | None) -> bool:
    required = os.environ.get('PRED_API_KEY')
    if not required:
        # no key configured — allow by default (NOT recommended in production)
        return True
    return x_api_key == required

def send_alert_email(to_email: str, username: str, prediction_prob: float, features: dict):
    print(f"DEBUG: send_alert_email called for {to_email}")
    smtp_server = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
    smtp_port = int(os.environ.get('SMTP_PORT', 587))
    smtp_username = os.environ.get('SMTP_USERNAME')
    smtp_password = os.environ.get('SMTP_PASSWORD')

    if not smtp_username or not smtp_password:
        missing = []
        if not smtp_username:
            missing.append("SMTP_USERNAME")
        if not smtp_password:
            missing.append("SMTP_PASSWORD")
        print(f"SMTP credentials not configured. Missing: {', '.join(missing)}. Skipping email.")
        return

    # Check for unusually high values
    alerts = []
    thresholds = {
        'pm2_5': 35,
        'pm10': 50,
        'o3': 100,
        'no2': 40,
        'so2': 20,
        'co': 4
    }
    
    for key, limit in thresholds.items():
        val = features.get(key)
        if val is not None and isinstance(val, (int, float)) and val > limit:
            alerts.append(f"- {key.upper()}: {val} (High, > {limit})")

    # Only send if risk is high or there are alerts
    is_high_risk = prediction_prob >= 0.5
    
    # if not is_high_risk and not alerts:
    #     print(f"DEBUG: Email skipped. Risk is {prediction_prob:.2f} (Low) and no environmental alerts found.")
    #     return

    subject = f"Asthma Risk Alert for {username}" if is_high_risk else f"Asthma Risk Update for {username}"
    
    body = f"""
    Hello {username},
    
    Here is your latest asthma risk assessment.
    
    Prediction Risk: {int(prediction_prob * 100)}%
    Status: {"HIGH RISK" if is_high_risk else "Low/Moderate Risk"}
    
    Location:
    Lat: {features.get('latitude', 'N/A')}
    Long: {features.get('longitude', 'N/A')}
    Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
    
    Heart Rate: {features.get('heart_rate', 'N/A')}
    Temperature: {features.get('temperature', 'N/A')}
    """
    
    if alerts:
        body += "\n\nWARNING - Unexpectedly High Datapoints:\n" + "\n".join(alerts)
        
    body += "\n\nStay Safe,\nBreathe Easy Team"

    msg = MIMEMultipart()
    msg['From'] = smtp_username
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    try:
        print(f"DEBUG: Attempting to connect to SMTP {smtp_server}:{smtp_port}")
        
        if smtp_port == 465:
            # Use SMTP_SSL for port 465 (Implicit SSL)
            print("DEBUG: Using SMTP_SSL (Implicit SSL)")
            server = smtplib.SMTP_SSL(smtp_server, smtp_port)
            server.set_debuglevel(1)
            server.ehlo()
            
            print(f"DEBUG: Logging in as {smtp_username}")
            server.login(smtp_username, smtp_password)
        else:
            # Use STARTTLS for 587 or others
            print("DEBUG: Using SMTP + STARTTLS")
            server = smtplib.SMTP(smtp_server, smtp_port)
            server.set_debuglevel(1)
            server.ehlo()
            
            print("DEBUG: Starting TLS")
            server.starttls()
            server.ehlo()
            
            print(f"DEBUG: Logging in as {smtp_username}")
            server.login(smtp_username, smtp_password)
        
        text = msg.as_string()
        print(f"DEBUG: Sending mail to {to_email}")
        server.sendmail(smtp_username, to_email, text)
        
        server.quit()
        print(f"Alert email sent to {to_email}")
    except Exception as e:
        import traceback
        print(f"Failed to send email: {e}")
        traceback.print_exc()


class EmailTestRequest(BaseModel):
    email: str
    username: str | None = None


@app.post('/email-test')
def email_test(req: EmailTestRequest):
    """Trigger a single email to validate SMTP configuration."""
    print(f"DEBUG: /email-test requested for {req.email}")
    features = {
        'latitude': 'N/A',
        'longitude': 'N/A',
        'heart_rate': 'N/A',
        'temperature': 'N/A',
    }
    send_alert_email(req.email, req.username or "User", 0.66, features)
    return {"ok": True}


@app.post('/predict')
def predict(req: PredictRequest, request: Request, background_tasks: BackgroundTasks, x_api_key: str | None = Header(None)):
    if not auth_ok(x_api_key):
        raise HTTPException(status_code=401, detail='Invalid API key')

    if artifact is None:
        raise HTTPException(status_code=500, detail='Model not available on server')

    pipeline = artifact.get('pipeline') if isinstance(artifact, dict) else artifact
    feature_names = artifact.get('feature_names') if isinstance(artifact, dict) else None
    # If the trained pipeline exposes feature_names_in_ use it as authoritative
    pipeline_feature_names = None
    try:
        if hasattr(pipeline, 'feature_names_in_'):
            pipeline_feature_names = list(getattr(pipeline, 'feature_names_in_'))
    except Exception:
        pipeline_feature_names = None

    # Build input row in the order expected by feature_names when available
    cols_to_use = pipeline_feature_names or feature_names
    if cols_to_use:
        # Build a normalized map of incoming keys for tolerant matching
        incoming_map = {canonical_name(k): k for k in req.features.keys()}
        row = []
        for f in cols_to_use:
            # 1) exact match
            if f in req.features:
                row.append(req.features.get(f))
                continue
            # 2) simple variants
            alt_us = f.replace(' ', '_')
            if alt_us in req.features:
                row.append(req.features.get(alt_us))
                continue
            alt_sp = f.replace('_', ' ')
            if alt_sp in req.features:
                row.append(req.features.get(alt_sp))
                continue
            # 3) normalized canonical match (lower + alnum)
            c = canonical_name(f)
            if c in incoming_map:
                row.append(req.features.get(incoming_map[c]))
                continue
            # not present
            row.append(np.nan)
        X = pd.DataFrame([row], columns=cols_to_use)
    else:
        # fallback: use keys as provided
        X = pd.DataFrame([req.features])

    # Ensure `user_key` is numeric — fallback to 447 when invalid to avoid conversion errors
    if 'user_key' in X.columns:
        try:
            X['user_key'] = pd.to_numeric(X['user_key'], errors='coerce').fillna(447)
        except Exception:
            # best-effort coerce; if it fails let pipeline handle it and return a sensible error
            pass

    try:
        proba = pipeline.predict_proba(X)[0, 1]
        pred = int(proba >= 0.5)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Prediction failed: {e}')

    # Build response
    resp = { 'probability': float(proba), 'risk_class': int(pred) }

    # If client requested an echo, include the received features and request headers
    try:
        echo = request.headers.get('x-echo-payload')
        if echo and str(echo).lower() in ('1', 'true', 'yes'):
            # include the features and a subset of headers for inspection
            hdrs = dict(request.headers)
            resp['echo'] = {
                'received_features': req.features,
                'received_headers': hdrs,
            }
    except Exception:
        # don't fail prediction because echoing failed
        pass

    # Send email alert in background
    if req.email:
        print(f"DEBUG: Scheduling email to {req.email} (Risk Prob: {proba:.2f})")
        # Add lat/long/timestamp to features if not present, for email body
        # They might be in req.features but might be named differently
        # Use what we have
        background_tasks.add_task(send_alert_email, req.email, req.username or "User", proba, req.features)
    else:
        print("DEBUG: Request received but no email address provided in payload.")

    return resp


# ============================================================================
# REGISTRATION ENDPOINT (uses service_role to bypass RLS)
# ============================================================================

class RegisterRequest(BaseModel):
    email: str
    password: str
    username: str
    dob: str  # YYYY-MM-DD
    gender: str
    phone_number: str
    email_id: str | None = None
    # Medical history fields
    diagnosis_status: bool
    diagnosis_date: str | None = None
    known_triggers: list | None = None
    attack_history: list | dict | None = None  # Accept both list and dict
    current_symptoms: list | None = None
    respiratory_issues: list | None = None
    allergies: list | None = None
    smoking_status: str = "never"
    family_history: bool = False
    chronic_conditions: list | None = None


@app.post("/register")
async def register(req: RegisterRequest):
    """
    Register a new user with profile and medical history.
    Uses Supabase service role to bypass RLS during registration.
    """
    try:
        from supabase import create_client
        import json
        
        # Get Supabase credentials from environment
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_service_role_key:
            raise HTTPException(status_code=500, detail="Supabase credentials not configured")
        
        # Create Supabase client with service role (bypasses RLS)
        supabase = create_client(supabase_url, supabase_service_role_key)
        
        # 1. Check if user already exists by email
        try:
            existing_users = supabase.auth.admin.list_users()
            # list_users() returns a list directly, not an object with .users attribute
            user_already_exists = any(u.email == req.email for u in existing_users)
            
            if user_already_exists:
                raise HTTPException(status_code=409, detail="User with this email already exists")
        except HTTPException:
            raise
        except Exception as e:
            # If we can't list users, try to create anyway (will fail if duplicate)
            print(f"Could not check existing users: {e}")
        
        # 2. Sign up the user and mark email as confirmed so login works immediately
        auth_response = supabase.auth.admin.create_user({
            "email": req.email,
            "password": req.password,
            "email_confirm": True,
        })
        
        user_id = auth_response.user.id
        
        # 3. Upsert profile (using service role, so RLS doesn't apply)
        # Upsert allows atomic update-or-insert, so retries won't fail
        profile_data = {
            "id": user_id,
            "username": req.username,
            "dob": req.dob,
            "gender": req.gender,
            "phone_number": req.phone_number,
            "email_id": req.email_id or req.email,
        }
        
        supabase.table("profiles").upsert(profile_data, on_conflict="id").execute()
        
        # 4. Upsert medical history
        # Convert attack_history to proper JSONB format (array or object both work)
        attack_history_value = req.attack_history if req.attack_history is not None else []
        
        medical_data = {
            "user_id": user_id,
            "diagnosis_status": req.diagnosis_status,
            "diagnosis_date": req.diagnosis_date,
            "known_triggers": req.known_triggers or [],
            "attack_history": attack_history_value,
            "current_symptoms": req.current_symptoms or [],
            "respiratory_issues": req.respiratory_issues or [],
            "allergies": req.allergies or [],
            "smoking_status": req.smoking_status,
            "family_history": req.family_history,
            "chronic_conditions": req.chronic_conditions or [],
        }
        
        supabase.table("medical_history").upsert(medical_data, on_conflict="user_id").execute()
        
        return {
            "success": True,
            "user_id": user_id,
            "message": "User registered successfully. Please check your email to confirm.",
        }
    
    except HTTPException:
        # Re-raise HTTP exceptions (like 409 conflict)
        raise
    except Exception as e:
        print(f"Registration error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
