from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import joblib
import numpy as np
import pandas as pd
import smtplib
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone, timedelta

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
    if os.path.exists(p):
        try:
            artifact = joblib.load(p)
            break
        except Exception as e:
            print(f"Error loading model from {p}: {e}")

if artifact is None:
    print("WARNING: No model artifact found.")

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
    return True if not required else x_api_key == required

def send_plain_email(to_email: str, subject: str, body: str) -> bool:
    brevo_api_key = os.environ.get('BREVO_API_KEY')
    brevo_from_email = os.environ.get('BREVO_FROM_EMAIL')
    brevo_from_name = os.environ.get('BREVO_FROM_NAME', 'Breathe Easy')

    # Try Brevo API first
    if brevo_api_key and brevo_from_email:
        try:
            payload = {
                "sender": {"name": brevo_from_name, "email": brevo_from_email},
                "to": [{"email": to_email}],
                "subject": subject,
                "textContent": body
            }
            headers = {
                "api-key": brevo_api_key,
                "Content-Type": "application/json"
            }
            resp = requests.post("https://api.brevo.com/v3/smtp/email", json=payload, headers=headers, timeout=15)
            if resp.status_code < 400:
                print(f"Email sent via Brevo to {to_email}")
                return True
            else:
                error_detail = resp.text
                print(f"Brevo API error ({resp.status_code}): {error_detail}")
        except Exception as e:
            print(f"Brevo failed: {e}")

    # Fallback to SMTP
    smtp_username = os.environ.get('SMTP_USERNAME')
    smtp_password = os.environ.get('SMTP_PASSWORD')
    if not smtp_username or not smtp_password:
        print("SMTP credentials not configured.")
        return False
    
    smtp_server = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
    smtp_port = int(os.environ.get('SMTP_PORT', 587))

    msg = MIMEMultipart()
    msg['From'] = smtp_username
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    try:
        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_server, smtp_port)
        else:
            server = smtplib.SMTP(smtp_server, smtp_port)
            server.starttls()
        
        server.login(smtp_username, smtp_password)
        server.sendmail(smtp_username, to_email, msg.as_string())
        server.quit()
        print(f"Email sent via SMTP to {to_email}")
        return True
    except Exception as e:
        print(f"Email send failed: {e}")
        return False


def send_alert_email(to_email: str, username: str, prediction_prob: float, features: dict):
    alerts = []
    thresholds = {'pm2_5': 35, 'pm10': 50, 'o3': 100, 'no2': 40, 'so2': 20, 'co': 4}
    for key, limit in thresholds.items():
        val = features.get(key)
        if val is not None and isinstance(val, (int, float)) and val > limit:
            alerts.append(f"- {key.upper()}: {val} (High, > {limit})")

    is_high_risk = prediction_prob >= 0.5
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
    send_plain_email(to_email, subject, body)


def send_ground_truth_reminder_email(
    to_email: str,
    username: str,
    prediction_prob: float,
    predicted_attack: bool,
    recorded_at: str | None,
):
    subject = "Follow-up needed: confirm your last asthma prediction"
    body = f"""
    Hello {username},

    Please confirm the outcome of your latest monitoring session.

    Predicted Risk: {int(prediction_prob * 100)}%
    Predicted Attack: {"Yes" if predicted_attack else "No"}
    Recorded At: {recorded_at or "N/A"}

    Please open the app and answer whether an attack was actually triggered.

    Thank you,
    Breathe Easy Team
    """
    return send_plain_email(to_email, subject, body)


class EmailTestRequest(BaseModel):
    email: str
    username: str | None = None


class GroundTruthReminderRequest(BaseModel):
    user_id: str
    record_id: str
    email: str
    username: str | None = None
    prediction_prob: float = 0.0
    predicted_attack: bool = False
    recorded_at: str | None = None


@app.post('/email-test')
def email_test(req: EmailTestRequest):
    """Send test email to validate SMTP configuration."""
    send_alert_email(req.email, req.username or "User", 0.66, {'latitude': 'N/A', 'longitude': 'N/A', 'heart_rate': 'N/A', 'temperature': 'N/A'})
    return {"ok": True}


@app.post('/ground-truth/reminder')
def ground_truth_reminder(req: GroundTruthReminderRequest, x_api_key: str | None = Header(None)):
    if not auth_ok(x_api_key):
        raise HTTPException(status_code=401, detail='Invalid API key')

    sent = send_ground_truth_reminder_email(
        req.email,
        req.username or "User",
        req.prediction_prob,
        req.predicted_attack,
        req.recorded_at,
    )

    # Mark reminder timestamp to avoid duplicate reminder emails on future logins.
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if sent and supabase_url and supabase_service_role_key:
        try:
            from supabase import create_client

            supabase = create_client(supabase_url, supabase_service_role_key)
            supabase.table("monitoring_data").update(
                {"reminder_sent_at": datetime.utcnow().isoformat()}
            ).eq("id", req.record_id).eq("user_id", req.user_id).is_("ground_truth", None).execute()
        except Exception as e:
            print(f"Failed to mark reminder_sent_at: {e}")

    return {"ok": True, "sent": bool(sent)}


@app.post('/ground-truth/reminder-sweep')
def ground_truth_reminder_sweep(x_api_key: str | None = Header(None)):
    """Send reminders for unanswered predictions older than configured delay.

    Configure delay with env GROUND_TRUTH_REMINDER_DELAY_MINUTES (default: 20).
    Intended for periodic invocation from Render Cron.
    """
    if not auth_ok(x_api_key):
        raise HTTPException(status_code=401, detail='Invalid API key')

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_service_role_key:
        raise HTTPException(status_code=500, detail="Supabase credentials not configured")

    try:
        from supabase import create_client

        supabase = create_client(supabase_url, supabase_service_role_key)
        delay_minutes = int(os.getenv("GROUND_TRUTH_REMINDER_DELAY_MINUTES", "20"))
        threshold_iso = (datetime.now(timezone.utc) - timedelta(minutes=delay_minutes)).isoformat()

        # Fetch due unanswered sessions.
        due = supabase.table("monitoring_data").select(
            "id,user_id,timestamp,attack_prediction,prediction_confidence,ground_truth,reminder_sent_at"
        ).is_("ground_truth", None).is_("reminder_sent_at", None).lte("timestamp", threshold_iso).order(
            "timestamp", desc=True
        ).execute()

        rows = due.data or []
        if not rows:
            return {"ok": True, "sent_count": 0, "checked_count": 0}

        # Keep only the latest pending record per user.
        latest_by_user = {}
        for row in rows:
            uid = row.get("user_id")
            if uid and uid not in latest_by_user:
                latest_by_user[uid] = row

        sent_count = 0
        for uid, row in latest_by_user.items():
            profile = supabase.table("profiles").select("email_id,username").eq("id", uid).maybe_single().execute()
            profile_data = profile.data or {}
            to_email = profile_data.get("email_id")
            username = profile_data.get("username") or "User"
            if not to_email:
                continue

            sent = send_ground_truth_reminder_email(
                to_email=to_email,
                username=username,
                prediction_prob=float(row.get("prediction_confidence") or 0.0),
                predicted_attack=bool(row.get("attack_prediction")),
                recorded_at=row.get("timestamp"),
            )

            if sent:
                supabase.table("monitoring_data").update(
                    {"reminder_sent_at": datetime.now(timezone.utc).isoformat()}
                ).eq("id", row.get("id")).eq("user_id", uid).is_("ground_truth", None).execute()
                sent_count += 1

        return {"ok": True, "sent_count": sent_count, "checked_count": len(latest_by_user)}
    except Exception as e:
        print(f"Reminder sweep failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/predict')
def predict(req: PredictRequest, request: Request, x_api_key: str | None = Header(None)):
    if not auth_ok(x_api_key):
        raise HTTPException(status_code=401, detail='Invalid API key')

    if artifact is None:
        raise HTTPException(status_code=500, detail='Model not available on server')

    pipeline = artifact.get('pipeline') if isinstance(artifact, dict) else artifact
    feature_names = artifact.get('feature_names') if isinstance(artifact, dict) else None
    
    pipeline_feature_names = None
    if hasattr(pipeline, 'feature_names_in_'):
        pipeline_feature_names = list(getattr(pipeline, 'feature_names_in_'))

    cols_to_use = pipeline_feature_names or feature_names
    if cols_to_use:
        incoming_map = {canonical_name(k): k for k in req.features.keys()}
        row = []
        for f in cols_to_use:
            if f in req.features:
                row.append(req.features[f])
            elif f.replace(' ', '_') in req.features:
                row.append(req.features[f.replace(' ', '_')])
            elif f.replace('_', ' ') in req.features:
                row.append(req.features[f.replace('_', ' ')])
            elif canonical_name(f) in incoming_map:
                row.append(req.features[incoming_map[canonical_name(f)]])
            else:
                row.append(np.nan)
        X = pd.DataFrame([row], columns=cols_to_use)
    else:
        X = pd.DataFrame([req.features])

    if 'user_key' in X.columns:
        X['user_key'] = pd.to_numeric(X['user_key'], errors='coerce').fillna(447)

    try:
        proba = pipeline.predict_proba(X)[0, 1]
        pred = int(proba >= 0.5)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Prediction failed: {e}')

    resp = {'probability': float(proba), 'risk_class': int(pred)}
    
    echo = request.headers.get('x-echo-payload')
    if echo and str(echo).lower() in ('1', 'true', 'yes'):
        resp['echo'] = {'received_features': req.features, 'received_headers': dict(request.headers)}
    
    if req.email:
        send_alert_email(req.email, req.username or "User", proba, req.features)
    
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
    """Register user with profile and medical history using service role."""
    try:
        from supabase import create_client
        
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
            user_already_exists = any(u.email == req.email for u in existing_users)
            
            if user_already_exists:
                raise HTTPException(status_code=409, detail="User with this email already exists")
        except HTTPException:
            raise
        except Exception as e:
            print(f"Could not check existing users: {e}")
        
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
