# SafeSphere

SafeSphere is a personal asthma-risk monitoring app that helps users understand how weather, air quality, pollen, heart rate, and past predictions combine into a clearer picture of day-to-day risk.

## What users get

- A guided dashboard that walks through location, weather, pollen, heart rate, and risk prediction in one flow.
- A live risk card that summarizes the current prediction in plain language.
- A map view of past events with filters for date, confidence bands, and time of day.
- A follow-up prompt that asks whether a prediction matched reality, so the history stays useful over time.
- A cleaner environmental view that turns weather and pollen into easy-to-scan cards instead of raw numbers.

## Why it is useful

- It turns several health and environment signals into something actionable.
- It gives a quick answer for the present moment and a longer-term history for patterns.
- It is designed to stay responsive while still showing rich context.

## Tech stack

- Frontend: React, TypeScript, Vite, Tailwind, shadcn/ui
- Backend: FastAPI, scikit-learn, pandas, NumPy
- Auth and data: Supabase
- External data: OpenWeatherMap, Open-Meteo, Brevo

## Run locally

### Frontend

```bash
npm ci
npm run dev
```

Minimum frontend env vars:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_OPENWEATHER_API_KEY=...
VITE_PRED_API_URL=https://your-backend-domain/predict
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

Minimum backend env vars:

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

## Main backend routes

- `POST /predict`
- `POST /register`
- `POST /email-test`
- `POST /ground-truth/reminder`
- `POST /ground-truth/reminder-sweep`
- `GET /ground-truth/reminder-status`

## Deployment notes

- Frontend build output is `dist`.
- Backend service root is `api`.
- Use HTTPS for deployed frontend-to-backend traffic.
- Keep secrets in deployment environment variables.
