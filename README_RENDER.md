## Render Deployment

This repository deploys as:

- Frontend static site from repository root (`dist` output)
- Backend web service from `api` directory

`render.yaml` contains frontend build/publish settings.

### Frontend (Static Site)

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- SPA rewrite to `/index.html`

Required frontend env vars:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_OPENWEATHER_API_KEY`
- `VITE_PRED_API_URL`
- `VITE_PRED_API_KEY`
- `VITE_GROUND_TRUTH_PROMPT_DELAY_MINUTES`
- `VITE_GROUND_TRUTH_REMINDER_DELAY_MINUTES`

### Backend (Web Service)

- Root directory: `api`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app:app --host 0.0.0.0 --port $PORT`

Required backend env vars:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PRED_API_KEY`
- `BREVO_API_KEY`
- `BREVO_FROM_EMAIL`
- `BREVO_FROM_NAME`
- `GROUND_TRUTH_REMINDER_DELAY_MINUTES`
- `ENABLE_BACKGROUND_REMINDER_SWEEP`
- `GROUND_TRUTH_SWEEP_INTERVAL_SECONDS`

### Reminder Workflow

- Background reminder sweep runs in backend.
- Only the latest unanswered prediction per user is emailed.
- Older unanswered predictions are handled in frontend follow-up cards.
