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
Create a `.env` file in the root directory (same level as `package.json`) with the following variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key

# External APIs
VITE_OPENWEATHER_API_KEY=your_openweather_api_key

# Prediction API (Local Backend)
VITE_PRED_API_URL=http://localhost:8000/predict
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

- `src/`: Frontend React application.
  - `components/`: UI components (Dashboard, RiskPrediction, etc.).
  - `pages/`: Main views (Auth, Dashboard, Register).
  - `integrations/supabase/`: Database connection and types.
- `api/`: Python backend for ML predictions.
  - `app.py`: FastAPI application entry point.
  - `model/`: Contains the trained `bagging_model.joblib`.
- `public/`: Static assets.

## Troubleshooting

- **Model Loading Error**: If the API warns about "No model artifact found", ensure `bagging_model.joblib` exists in `api/model/` or `public/`.
- **CORS Issues**: The backend is configured to allow all origins (`*`). If you change ports or deployment method, verify the CORS middleware in `api/app.py`.
