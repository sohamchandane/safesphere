# SafeSphere API

## Run Locally

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

## Required Environment Variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PRED_API_KEY`
- `BREVO_API_KEY`
- `BREVO_FROM_EMAIL`
- `BREVO_FROM_NAME`
- `GROUND_TRUTH_REMINDER_DELAY_MINUTES`
- `ENABLE_BACKGROUND_REMINDER_SWEEP`
- `GROUND_TRUTH_SWEEP_INTERVAL_SECONDS`

## Endpoints

- `POST /predict`
- `POST /register`
- `POST /email-test`
- `POST /ground-truth/reminder`
- `POST /ground-truth/reminder-sweep`
- `GET /ground-truth/reminder-status`

## Reminder Rules

- Reminder emails are sent only for each user's latest unanswered prediction.
- Older unanswered predictions are intended to be answered from frontend follow-up cards.
