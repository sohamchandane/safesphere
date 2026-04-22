from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import joblib
import numpy as np
import pandas as pd
from dotenv import load_dotenv
import threading
import time
import requests
from requests.adapters import HTTPAdapter
from datetime import datetime, timezone, timedelta

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

app = FastAPI(title="SafeSphere Prediction API")

_reminder_worker_started = False
_last_sweep_started_at: str | None = None
_last_sweep_completed_at: str | None = None
_last_sweep_result: dict | None = None
_last_sweep_error: str | None = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATHS = [
    os.path.join(os.path.dirname(__file__), "model", "bagging_model.joblib"),
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

PIPELINE = artifact.get('pipeline') if isinstance(artifact, dict) else artifact
ARTIFACT_FEATURE_NAMES = artifact.get('feature_names') if isinstance(artifact, dict) else None
PIPELINE_FEATURE_NAMES = list(getattr(PIPELINE, 'feature_names_in_', [])) if PIPELINE is not None and hasattr(PIPELINE, 'feature_names_in_') else None
PREDICT_COLUMNS = PIPELINE_FEATURE_NAMES or ARTIFACT_FEATURE_NAMES

_http = requests.Session()
_http.mount("https://", HTTPAdapter(pool_connections=10, pool_maxsize=20))
_http.mount("http://", HTTPAdapter(pool_connections=10, pool_maxsize=20))

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


def is_missing_column_error(err: Exception, column_name: str, table_name: str) -> bool:
    msg = str(err).lower()
    missing_column_tokens = (
        "pgrst204",  # PostgREST schema cache error
        "42703",     # PostgreSQL undefined_column
        "does not exist",
    )
    return (
        any(token in msg for token in missing_column_tokens)
        and column_name.lower() in msg
        and table_name.lower() in msg
    )


def safe_response_data(resp, default):
    """Safely read Supabase response .data when the SDK returns None-like objects."""
    data = getattr(resp, "data", None) if resp is not None else None
    return default if data is None else data


def get_profile_contact_info(supabase, user_id: str) -> tuple[str | None, str]:
    """Return (email, username) with backward-compatible fallback for older schemas."""
    def auth_email_fallback() -> str | None:
        try:
            auth_user_resp = supabase.auth.admin.get_user_by_id(user_id)
            user_obj = getattr(auth_user_resp, "user", None)
            return getattr(user_obj, "email", None)
        except Exception as auth_e:
            print(f"Could not fetch auth email for {user_id}: {auth_e}")
            return None

    try:
        profile = supabase.table("profiles").select("email_id,username").eq("id", user_id).maybe_single().execute()
        profile_data = safe_response_data(profile, {})
        email_id = profile_data.get("email_id")
        username = profile_data.get("username") or "User"

        # If email_id column exists but value is null/blank, fallback to auth email.
        if not email_id:
            email_id = auth_email_fallback()

        return email_id, username
    except Exception as e:
        if not is_missing_column_error(e, "email_id", "profiles"):
            raise

    # Fallback path when profiles.email_id does not exist.
    profile = supabase.table("profiles").select("username").eq("id", user_id).maybe_single().execute()
    profile_data = safe_response_data(profile, {})
    username = profile_data.get("username") or "User"

    return auth_email_fallback(), username

def send_plain_email(to_email: str, subject: str, body: str) -> bool:
    brevo_api_key = os.environ.get('BREVO_API_KEY')
    brevo_from_email = os.environ.get('BREVO_FROM_EMAIL')
    brevo_from_name = os.environ.get('BREVO_FROM_NAME', 'SafeSphere')

    if not brevo_api_key or not brevo_from_email:
        print("Brevo credentials not configured.")
        return False

    try:
        payload = {
            "sender": {"name": brevo_from_name, "email": brevo_from_email},
            "to": [{"email": to_email}],
            "subject": subject,
            "textContent": body,
        }
        headers = {
            "api-key": brevo_api_key,
            "Content-Type": "application/json",
        }
        resp = _http.post("https://api.brevo.com/v3/smtp/email", json=payload, headers=headers, timeout=15)
        if resp.status_code >= 400:
            print(f"Brevo API error ({resp.status_code}): {resp.text}")
            return False
        print(f"Email sent via Brevo to {to_email}")
        return True
    except Exception as e:
        print(f"Brevo failed: {e}")
        return False


def send_alert_email(to_email: str, username: str, prediction_prob: float, features: dict):
    alerts = []
    thresholds = {'pm2_5': 35, 'pm10': 50, 'o3': 100, 'no2': 40, 'so2': 20, 'co': 4}
    for key, limit in thresholds.items():
        val = features.get(key)
        if val is not None and isinstance(val, (int, float)) and val > limit:
            alerts.append(f"- {key.upper()}: {val} (High, > {limit})")

    if prediction_prob >= 0.75:
        risk_level = "HIGH RISK"
        subject = f"Asthma High Risk Alert for {username}"
    elif prediction_prob >= 0.5:
        risk_level = "MODERATE RISK"
        subject = f"Asthma Moderate Risk Update for {username}"
    else:
        risk_level = "LOW RISK"
        subject = f"Asthma Low Risk Update for {username}"

    body = f"""
    Hello {username},

    Here is your latest asthma risk assessment.

    Prediction Risk: {int(prediction_prob * 100)}%
    Status: {risk_level}

    Location:
    Lat: {features.get('latitude', 'N/A')}
    Long: {features.get('longitude', 'N/A')}
    Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

    Heart Rate: {features.get('heart_rate', 'N/A')}
    Temperature: {features.get('temperature', 'N/A')}
    """

    if alerts:
        body += "\n\nWARNING - Unexpectedly High Datapoints:\n" + "\n".join(alerts)

    body += "\n\nStay Safe,\nSafeSphere Team"
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
    SafeSphere Team
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
    """Send test email to validate email provider configuration."""
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


def run_ground_truth_reminder_sweep() -> dict:
    """Send due reminders only for each user's latest unanswered session."""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_service_role_key:
        raise RuntimeError("Supabase credentials not configured")

    from supabase import create_client

    supabase = create_client(supabase_url, supabase_service_role_key)
    delay_minutes = int(os.getenv("GROUND_TRUTH_REMINDER_DELAY_MINUTES", "20"))
    threshold_iso = (datetime.now(timezone.utc) - timedelta(minutes=delay_minutes)).isoformat()

    # Fetch all unanswered sessions and keep only the latest per user.
    pending = supabase.table("monitoring_data").select(
        "id,user_id,timestamp,attack_prediction,prediction_confidence,ground_truth,reminder_sent_at"
    ).is_("ground_truth", None).order(
        "timestamp", desc=True
    ).execute()

    rows = safe_response_data(pending, [])
    if not rows:
        return {
            "ok": True,
            "sent_count": 0,
            "checked_count": 0,
            "pending_rows": 0,
            "eligible_count": 0,
            "no_email_count": 0,
            "send_failed_count": 0,
            "skipped_not_due_count": 0,
            "skipped_already_reminded_count": 0,
        }

    # Keep only the latest pending record per user.
    latest_by_user = {}
    for row in rows:
        uid = row.get("user_id")
        if uid and uid not in latest_by_user:
            latest_by_user[uid] = row

    sent_count = 0
    eligible_count = 0
    no_email_count = 0
    send_failed_count = 0
    skipped_not_due_count = 0
    skipped_already_reminded_count = 0
    for uid, row in latest_by_user.items():
        ts = row.get("timestamp")
        if not ts or str(ts) > threshold_iso:
            skipped_not_due_count += 1
            continue

        # Never send reminders for older backlog rows. If latest unanswered row has
        # already been reminded, skip this user entirely until they answer in-app.
        if row.get("reminder_sent_at"):
            skipped_already_reminded_count += 1
            continue

        eligible_count += 1
        to_email, username = get_profile_contact_info(supabase, uid)
        if not to_email:
            no_email_count += 1
            print(f"Reminder sweep skipped user {uid}: no email found")
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
        else:
            send_failed_count += 1
            print(f"Reminder sweep failed to send email to {to_email} for user {uid}")

    return {
        "ok": True,
        "sent_count": sent_count,
        "checked_count": len(latest_by_user),
        "pending_rows": len(rows),
        "eligible_count": eligible_count,
        "no_email_count": no_email_count,
        "send_failed_count": send_failed_count,
        "skipped_not_due_count": skipped_not_due_count,
        "skipped_already_reminded_count": skipped_already_reminded_count,
    }


@app.get('/ground-truth/reminder-status')
def ground_truth_reminder_status(x_api_key: str | None = Header(None)):
    """Return reminder scheduler and delivery diagnostics."""
    if not auth_ok(x_api_key):
        raise HTTPException(status_code=401, detail='Invalid API key')

    delay_minutes = int(os.getenv("GROUND_TRUTH_REMINDER_DELAY_MINUTES", "20"))
    interval_seconds = max(30, int(os.getenv("GROUND_TRUTH_SWEEP_INTERVAL_SECONDS", "60")))
    enabled = os.getenv("ENABLE_BACKGROUND_REMINDER_SWEEP", "true").strip().lower() in ("1", "true", "yes", "on")

    email_provider = {
        "brevo_configured": bool(os.getenv("BREVO_API_KEY") and os.getenv("BREVO_FROM_EMAIL")),
    }

    due_preview = None
    try:
        from supabase import create_client

        supabase_url = os.getenv("SUPABASE_URL")
        supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if supabase_url and supabase_service_role_key:
            supabase = create_client(supabase_url, supabase_service_role_key)
            threshold_iso = (datetime.now(timezone.utc) - timedelta(minutes=delay_minutes)).isoformat()
            pending = supabase.table("monitoring_data").select(
                "id,user_id,timestamp,reminder_sent_at"
            ).is_("ground_truth", None).order("timestamp", desc=True).execute()
            rows = safe_response_data(pending, [])

            latest_by_user = {}
            for row in rows:
                uid = row.get("user_id")
                if uid and uid not in latest_by_user:
                    latest_by_user[uid] = row

            due_users = 0
            already_reminded_latest = 0
            not_due_latest = 0
            for row in latest_by_user.values():
                if row.get("reminder_sent_at"):
                    already_reminded_latest += 1
                    continue
                ts = row.get("timestamp")
                if ts and str(ts) <= threshold_iso:
                    due_users += 1
                else:
                    not_due_latest += 1

            due_preview = {
                "due_users": due_users,
                "latest_pending_users": len(latest_by_user),
                "already_reminded_latest": already_reminded_latest,
                "not_due_latest": not_due_latest,
            }
    except Exception as e:
        due_preview = {"error": str(e)}

    return {
        "ok": True,
        "scheduler": {
            "enabled": enabled,
            "worker_started": _reminder_worker_started,
            "delay_minutes": delay_minutes,
            "interval_seconds": interval_seconds,
        },
        "last_sweep": {
            "started_at": _last_sweep_started_at,
            "completed_at": _last_sweep_completed_at,
            "result": _last_sweep_result,
            "error": _last_sweep_error,
        },
        "email_provider": email_provider,
        "due_preview": due_preview,
    }


@app.post('/ground-truth/reminder-sweep')
def ground_truth_reminder_sweep(x_api_key: str | None = Header(None)):
    """Send reminders for unanswered predictions older than configured delay.

    Configure delay with env GROUND_TRUTH_REMINDER_DELAY_MINUTES (default: 20).
    Intended for periodic invocation from Render Cron.
    """
    if not auth_ok(x_api_key):
        raise HTTPException(status_code=401, detail='Invalid API key')

    try:
        return run_ground_truth_reminder_sweep()
    except Exception as e:
        print(f"Reminder sweep failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _background_reminder_sweep_worker():
    global _last_sweep_started_at, _last_sweep_completed_at, _last_sweep_result, _last_sweep_error
    interval_seconds = max(30, int(os.getenv("GROUND_TRUTH_SWEEP_INTERVAL_SECONDS", "60")))
    while True:
        try:
            if os.getenv("ENABLE_BACKGROUND_REMINDER_SWEEP", "true").strip().lower() in ("1", "true", "yes", "on"):
                _last_sweep_started_at = datetime.now(timezone.utc).isoformat()
                result = run_ground_truth_reminder_sweep()
                _last_sweep_result = result
                _last_sweep_error = None
                _last_sweep_completed_at = datetime.now(timezone.utc).isoformat()
                if result.get("sent_count", 0):
                    print(f"Background reminder sweep sent {result.get('sent_count')} emails")
                else:
                    print(f"Background reminder sweep checked {result.get('checked_count', 0)} users, sent 0")
        except Exception as e:
            _last_sweep_error = str(e)
            _last_sweep_completed_at = datetime.now(timezone.utc).isoformat()
            print(f"Background reminder sweep error: {e}")
        time.sleep(interval_seconds)


@app.on_event("startup")
def start_background_reminder_sweep():
    global _reminder_worker_started
    if _reminder_worker_started:
        return

    if os.getenv("ENABLE_BACKGROUND_REMINDER_SWEEP", "true").strip().lower() not in ("1", "true", "yes", "on"):
        print("Background reminder sweep disabled by ENABLE_BACKGROUND_REMINDER_SWEEP")
        return

    worker = threading.Thread(target=_background_reminder_sweep_worker, daemon=True, name="ground-truth-reminder-sweep")
    worker.start()
    _reminder_worker_started = True
    print("Background reminder sweep worker started")


@app.post('/predict')
def predict(req: PredictRequest, x_api_key: str | None = Header(None)):
    if not auth_ok(x_api_key):
        raise HTTPException(status_code=401, detail='Invalid API key')

    if artifact is None:
        raise HTTPException(status_code=500, detail='Model not available on server')

    pipeline = PIPELINE
    cols_to_use = PREDICT_COLUMNS
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
    created_user_id = None
    try:
        from supabase import create_client
        
        # Get Supabase credentials from environment
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_service_role_key:
            raise HTTPException(status_code=500, detail="Supabase credentials not configured")
        
        # Create Supabase client with service role (bypasses RLS)
        supabase = create_client(supabase_url, supabase_service_role_key)

        normalized_email = (req.email or "").strip().lower()
        normalized_username = (req.username or "").strip()
        if not normalized_email or not normalized_username:
            raise HTTPException(status_code=400, detail="Email and username are required")

        # 1. Check if username is already taken before creating auth user.
        existing_profile = supabase.table("profiles").select("id").eq("username", normalized_username).limit(1).execute()
        if safe_response_data(existing_profile, []):
            raise HTTPException(status_code=409, detail="Username is already taken")
        
        # 2. Best-effort check if user already exists by email.
        try:
            existing_users_resp = supabase.auth.admin.list_users()
            users = getattr(existing_users_resp, "users", None) or []
            user_already_exists = any((getattr(u, "email", "") or "").lower() == normalized_email for u in users)
            
            if user_already_exists:
                raise HTTPException(status_code=409, detail="User with this email already exists")
        except HTTPException:
            raise
        except Exception as e:
            print(f"Could not check existing users: {e}")
        
        auth_response = supabase.auth.admin.create_user({
            "email": normalized_email,
            "password": req.password,
            "email_confirm": True,
        })
        
        user_id = str(auth_response.user.id)
        created_user_id = user_id
        
        # 3. Upsert profile (using service role, so RLS doesn't apply)
        # Upsert allows atomic update-or-insert, so retries won't fail
        profile_data = {
            "id": user_id,
            "username": normalized_username,
            "dob": req.dob,
            "gender": req.gender,
            "phone_number": req.phone_number,
            "email_id": req.email_id or normalized_email,
        }

        try:
            supabase.table("profiles").upsert(profile_data, on_conflict="id").execute()
        except Exception as profile_error:
            # Backward compatibility for deployments where profiles.email_id column isn't present yet.
            if is_missing_column_error(profile_error, "email_id", "profiles"):
                fallback_profile_data = {k: v for k, v in profile_data.items() if k != "email_id"}
                supabase.table("profiles").upsert(fallback_profile_data, on_conflict="id").execute()
                print("profiles.email_id not found; retried registration upsert without email_id")
            else:
                raise
        
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
        error_text = str(e)

        # If auth user was created but profile/medical write failed, clean it up
        # so retry doesn't hit a false "user already exists" state.
        if created_user_id:
            try:
                from supabase import create_client

                cleanup_client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
                cleanup_client.auth.admin.delete_user(created_user_id)
                print(f"Rolled back auth user after registration failure: {created_user_id}")
            except Exception as cleanup_error:
                print(f"Failed to rollback created auth user {created_user_id}: {cleanup_error}")

        print(f"Registration error: {e}")
        lowered = error_text.lower()
        if "already" in lowered and ("registered" in lowered or "exists" in lowered):
            raise HTTPException(status_code=409, detail="User with this email already exists")
        if "profiles_username_key" in lowered or "username" in lowered and "duplicate" in lowered:
            raise HTTPException(status_code=409, detail="Username is already taken")
        raise HTTPException(status_code=400, detail=error_text)
