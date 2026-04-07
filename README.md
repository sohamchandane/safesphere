# Breathe Easy Predict

Breathe Easy Predict is an integrated asthma risk monitoring and prediction application. It combines real-time environmental data (weather, pollen, air quality) with user health metrics to predict the risk of asthma attacks using a machine learning model.

## Features

- **Risk Prediction**: Uses a Bagging Classifier model to predict asthma attack risk based on environmental factors (temperature, pressure, pollutants) and user history.
- **Real-time Monitoring**: Displays current temperature, air quality index, and individual pollutant levels (CO, NO2, O3, PM2.5, etc.).
- **Dashboard**: User-friendly dashboard for tracking health status, environmental conditions, and attack history.
- **User Authentication**: Secure login and registration powered by Supabase.
- **Location-based Services**: Fetches local weather and pollution data based on user location.
- **Pollen Data**: Tracks pollen levels (grass, tree, weed) to improve prediction accuracy.

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Shadcn UI
- **Backend API**: Python, FastAPI, Scikit-learn
- **Database & Auth**: Supabase
- **External APIs**: OpenWeatherMap

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v16 or higher)
- [Python](https://www.python.org/) (v3.8 or higher)
- A [Supabase](https://supabase.com/) account
- An [OpenWeatherMap](https://openweathermap.org/) API key

## Installation & Setup

### 1. Clone the repository
```bash
git clone https://github.com/sohamchandane/safesphere.git
cd breathe-easy-predict
```

### 2. Frontend Setup
Navigate to the root directory and install dependencies:
```bash
npm install
```

### 3. Backend Setup
Navigate to the `api` folder, set up a virtual environment, and install dependencies:
```bash
cd api
python -m venv venv

# Activate virtual environment:
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cd ..
```

### 4. Environment Configuration

#### Frontend (.env)
Create a `.env` file in the root directory with:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_OPENWEATHER_API_KEY=your_openweather_api_key
VITE_PRED_API_URL=http://localhost:8000
VITE_PRED_API_KEY=optional_api_key_for_backend
VITE_GROUND_TRUTH_PROMPT_DELAY_MINUTES=10
VITE_GROUND_TRUTH_REMINDER_DELAY_MINUTES=20
```

#### Backend (.env in `api/` folder)
Create a `.env` file in the `api` folder with:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

PRED_API_KEY=optional_api_key_for_predictions

SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password

BREVO_API_KEY=your_brevo_api_key
BREVO_FROM_EMAIL=alerts@yourdomain.com
BREVO_FROM_NAME=Breathe Easy
GROUND_TRUTH_REMINDER_DELAY_MINUTES=20
```

## Running the Application

You need to run both the Python backend and the React frontend simultaneously.

**1. Start the Backend Server**
Open a terminal, navigate to the `api` folder, and run:
```bash
# Ensure your virtual environment is activated
uvicorn app:app --reload --port 8000
```
The API serves predictions and will be available at `http://localhost:8000`.

**2. Start the Frontend Development Server**
Open a new terminal in the root directory and run:
```bash
npm run dev
```
The application will be accessible at `http://localhost:8080`.

## Project Structure

- `src/`: Frontend React application
  - `components/`: Reusable UI components
  - `pages/`: Route pages (Auth, Dashboard, Register, etc.)
  - `integrations/supabase/`: Supabase client and types
- `api/`: Python FastAPI backend
  - `app.py`: Main API application with prediction, registration endpoints
  - `model/`: Pre-trained ML model
- `public/`: Static assets and model backup
- `supabase/`: Database migrations and configuration

## API Endpoints

### `/predict` (POST)
Predicts asthma attack risk based on environmental and health features.

**Request:**
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
    "latitude": 19.0760,
    "longitude": 72.8777
  },
  "email": "user@example.com",
  "username": "johndoe"
}
```

**Response:**
```json
{
  "probability": 0.68,
  "risk_class": 1
}
```

Headers:
- `x-api-key` (optional): API key if `PRED_API_KEY` is configured
- `x-echo-payload` (optional): Set to `1` or `true` to echo received data

### `/register` (POST)
Register a new user with medical history.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure_password",
  "username": "johndoe",
  "dob": "1990-01-15",
  "gender": "Male",
  "phone_number": "+91-9876543210",
  "diagnosis_status": true,
  "diagnosis_date": "2020-05-10",
  "known_triggers": ["pollen", "dust"],
  "attack_history": [],
  "current_symptoms": [],
  "respiratory_issues": ["asthma"],
  "allergies": ["pollen"],
  "smoking_status": "never",
  "family_history": true,
  "chronic_conditions": []
}
```

### `/email-test` (POST)
Send a test email to validate SMTP configuration.

**Request:**
```json
{
  "email": "test@example.com",
  "username": "testuser"
}
```

## Troubleshooting

- **Model Loading Error**: Ensure `bagging_model.joblib` exists in `api/model/` or `public/`
- **CORS Issues**: Backend allows all origins by default. Adjust in `api/app.py` if needed
- **Database Connection**: Verify Supabase credentials in environment variables
- **Email Not Sending**: Check Brevo sender verification, `BREVO_*` variables, and SMTP fallback credentials

## License

This project is open source. See LICENSE file for details.