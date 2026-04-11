# SafeSphere

SafeSphere is a prototype for asthma-risk monitoring and early warning. It combines live environmental signals, pollen exposure, and wearable heart-rate data to predict the likelihood of an asthma trigger day.

The current prototype includes user authentication, profile registration, location-aware environmental monitoring, heart-rate capture, risk prediction, attack-history tracking, and ground-truth follow-up reminders.

## Current Prototype

- Landing page with clear entry paths for registration and sign-in
- Secure authentication through Supabase
- Registration flow with medical history capture
- Dashboard with location access, weather, pollen, and heart-rate monitoring
- Risk prediction powered by the deployed Bagging model artifact
- Attack history and ground-truth reminder follow-up for feedback collection
- Email notifications for prediction alerts and reminder nudges

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Shadcn UI
- Backend: FastAPI, Python, Scikit-learn, Pandas, NumPy
- Auth and database: Supabase
- External services: OpenWeatherMap, Brevo or SMTP email delivery

## Model Summary

The production prototype currently loads a Bagging classifier from `api/model/bagging_model.joblib` or `public/bagging_model.joblib`. The model consumes environmental variables such as temperature, pressure, humidity, pollutants, pollen levels, and heart rate to predict daily trigger risk.

## Setup

### Prerequisites

- Node.js 16 or higher
- Python 3.8 or higher
- Supabase project and keys
- OpenWeatherMap API key

### Frontend

```bash
npm ci
```

Create a `.env` file in the repository root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_OPENWEATHER_API_KEY=your_openweather_api_key
VITE_PRED_API_URL=http://localhost:8000/predict
VITE_PRED_API_KEY=optional_api_key_for_backend
VITE_GROUND_TRUTH_PROMPT_DELAY_MINUTES=10
VITE_GROUND_TRUTH_REMINDER_DELAY_MINUTES=20
```

### Backend

```bash
cd api
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Create `api/.env`:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PRED_API_KEY=optional_api_key_for_predictions
BREVO_API_KEY=your_brevo_api_key
BREVO_FROM_EMAIL=alerts@yourdomain.com
BREVO_FROM_NAME=SafeSphere
GROUND_TRUTH_REMINDER_DELAY_MINUTES=20
ENABLE_BACKGROUND_REMINDER_SWEEP=true
GROUND_TRUTH_SWEEP_INTERVAL_SECONDS=60
```

## Run Locally

Start the backend:

```bash
cd api
uvicorn app:app --reload --port 8000
```

Start the frontend in a second terminal:

```bash
npm run dev
```

The frontend runs on Vite dev server, and the API serves predictions on `http://localhost:8000`.

## Main User Flow

1. A user registers through the backend `/register` endpoint and then logs in through Supabase Auth.
2. The dashboard requests location permission and fetches local weather and pollen data.
3. The user records or streams heart-rate data.
4. The prototype combines these inputs and calls the prediction API.
5. The risk score is shown, stored, and used to drive alert and follow-up reminders.

## Authentication

- Sign in and session management are powered by Supabase Authentication.
- User registration captures both account details and medical history.
- If a registration conflict occurs (for example, existing email or username), the API returns a clear error.

## API Endpoints

### `POST /predict`
Returns the asthma risk probability and class.

Request example:

```json
{
  "features": {
    "temperature": 25.5,
    "humidity": 60,
    "pm2_5": 45,
    "pm10": 70,
    "o3": 85,
    "no2": 30,
    "so2": 15,
    "co": 2.5,
    "heart_rate": 72,
    "latitude": 11.1076,
    "longitude": 15.8777
  },
  "email": "user@example.com",
  "username": "johndoe"
}
```

### `POST /register`
Creates a Supabase auth user and stores the profile plus medical history.
Returns `409` for existing email or username conflicts.

### `POST /email-test`
Sends a test email to verify SMTP or Brevo settings.

### `POST /ground-truth/reminder`
Sends a follow-up reminder for a specific prediction record.

### `POST /ground-truth/reminder-sweep`
Finds unanswered monitoring records and sends reminders in batch.

## Project Structure

- `src/`: React frontend application
  - `pages/`: Landing, auth, register, dashboard, and fallback routes
  - `components/dashboard/`: Location, weather, pollen, heart-rate, prediction, and history widgets
  - `contexts/`: Authentication state
- `api/`: FastAPI backend and model-serving logic
  - `app.py`: Prediction, registration, and reminder endpoints
  - `model/`: Deployed model artifact
- `public/`: Static assets and backup model file
- `supabase/`: Database schema and migrations

## Notes

- The prototype is optimized for recall, because missed trigger days are more costly than false alarms in this use case.
- Web Bluetooth works best in Chromium-based browsers and requires HTTPS or localhost.
- Location access requires browser permission.
- If the model file is missing, the API will return a model-unavailable error until `bagging_model.joblib` is restored.

## License

This project is open source. See the license file if present in the repository.