Asthma Prediction API

Usage

- The API exposes `POST /predict` which expects JSON: `{ "features": { ... } }`.
- It loads the model artifact from `api/model/bagging_model.joblib` or `public/bagging_model.joblib`.
- Secure the endpoint by setting environment variable `PRED_API_KEY` on Render and sending the same key in header `x-api-key`.

Start locally

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r api/requirements.txt
uvicorn api.app:app --host 0.0.0.0 --port 8000 --reload
```

Deploy to Render

- Create a new Web Service in Render using this repo and set the Root Directory to `api`.
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app:app --host 0.0.0.0 --port $PORT`
- Add environment variable `PRED_API_KEY` with a strong secret.
