# SafeSphere

Frontend + backend monorepo for SafeSphere monitoring, prediction, history tracking, and follow-up workflows.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind, shadcn/ui
- Backend: FastAPI, scikit-learn, pandas, NumPy
- Data/Auth: Supabase
- External APIs: OpenWeatherMap, Brevo

## Local Setup

### Frontend

```bash
npm ci
npm run dev
```

Root `.env` (minimum):

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_OPENWEATHER_API_KEY=...
VITE_PRED_API_URL=http://localhost:8000/predict
VITE_PRED_API_KEY=...
VITE_GROUND_TRUTH_PROMPT_DELAY_MINUTES=10
VITE_GROUND_TRUTH_REMINDER_DELAY_MINUTES=10
```

### Backend

```bash
cd api
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

`api/.env` (minimum):

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
PRED_API_KEY=...
BREVO_API_KEY=...
BREVO_FROM_EMAIL=...
BREVO_FROM_NAME=SafeSphere
GROUND_TRUTH_REMINDER_DELAY_MINUTES=10
ENABLE_BACKGROUND_REMINDER_SWEEP=true
GROUND_TRUTH_SWEEP_INTERVAL_SECONDS=60
```

## Backend Endpoints

- `POST /predict`
- `POST /register`
- `POST /email-test`
- `POST /ground-truth/reminder`
- `POST /ground-truth/reminder-sweep`
- `GET /ground-truth/reminder-status`

## Follow-up Reminder Behavior

- Reminder email is sent only for the latest unanswered prediction per user.
- Older unanswered predictions are handled in the frontend follow-up UI.
- Background sweep interval and delay are controlled via backend env variables.

## Risk Map

- Dashboard includes a user-private Risk Map based on `monitoring_data` coordinates.
- Layer A: predicted events (all predictions), Layer B: confirmed attacks (`ground_truth=true`).
- Filters: date range, risk bands, event layer, and time-of-day.
- Low zoom uses hotspot aggregation (~150m grid), mid zoom uses marker clustering, high zoom shows individual markers.
- Marker details include timestamp, probability, prediction/confirmation flags, location, and available health/environment factors.
- No extra map API key is required (OpenStreetMap tiles).

### Required DB Migration

Apply the migration in `supabase/migrations/20260414_add_monitoring_data_map_indexes.sql` to improve map query performance.

## Deployment Notes

- Frontend build output is `dist`.
- Backend service root is `api`.
- Keep secrets in deployment environment variables; do not commit real secrets.