from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import joblib
import numpy as np
import pandas as pd

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
    try:
        if os.path.exists(p):
            artifact = joblib.load(p)
            print(f"Loaded model from {p}")
            break
    except Exception as e:
        print(f"Could not load model from {p}: {e}")

if artifact is None:
    print("WARNING: No model artifact found. /predict will return 500 until the model is available.")
else:
    try:
        fn = artifact.get('feature_names') if isinstance(artifact, dict) else None
        print(f"Model feature_names: {fn}")
    except Exception as e:
        print(f"Could not read feature_names from artifact: {e}")

# artifact expected to be { 'pipeline': Pipeline, 'feature_names': [...] }

class PredictRequest(BaseModel):
    features: dict


def canonical_name(s: str | None) -> str:
    """Normalize a feature name for robust matching: lowercase + remove non-alphanumeric."""
    if s is None:
        return ""
    return ''.join(ch.lower() for ch in str(s) if ch.isalnum())

def auth_ok(x_api_key: str | None) -> bool:
    required = os.environ.get('PRED_API_KEY')
    if not required:
        # no key configured — allow by default (NOT recommended in production)
        return True
    return x_api_key == required


@app.post('/predict')
def predict(req: PredictRequest, request: Request, x_api_key: str | None = Header(None)):
    if not auth_ok(x_api_key):
        raise HTTPException(status_code=401, detail='Invalid API key')

    if artifact is None:
        raise HTTPException(status_code=500, detail='Model not available on server')

    pipeline = artifact.get('pipeline') if isinstance(artifact, dict) else artifact
    feature_names = artifact.get('feature_names') if isinstance(artifact, dict) else None
    # If the trained pipeline exposes feature_names_in_ use it as authoritative
    pipeline_feature_names = None
    try:
        if hasattr(pipeline, 'feature_names_in_'):
            pipeline_feature_names = list(getattr(pipeline, 'feature_names_in_'))
    except Exception:
        pipeline_feature_names = None

    # Build input row in the order expected by feature_names when available
    cols_to_use = pipeline_feature_names or feature_names
    if cols_to_use:
        # Build a normalized map of incoming keys for tolerant matching
        incoming_map = {canonical_name(k): k for k in req.features.keys()}
        row = []
        for f in cols_to_use:
            # 1) exact match
            if f in req.features:
                row.append(req.features.get(f))
                continue
            # 2) simple variants
            alt_us = f.replace(' ', '_')
            if alt_us in req.features:
                row.append(req.features.get(alt_us))
                continue
            alt_sp = f.replace('_', ' ')
            if alt_sp in req.features:
                row.append(req.features.get(alt_sp))
                continue
            # 3) normalized canonical match (lower + alnum)
            c = canonical_name(f)
            if c in incoming_map:
                row.append(req.features.get(incoming_map[c]))
                continue
            # not present
            row.append(np.nan)
        X = pd.DataFrame([row], columns=cols_to_use)
    else:
        # fallback: use keys as provided
        X = pd.DataFrame([req.features])

    # Ensure `user_key` is numeric — fallback to 447 when invalid to avoid conversion errors
    if 'user_key' in X.columns:
        try:
            X['user_key'] = pd.to_numeric(X['user_key'], errors='coerce').fillna(447)
        except Exception:
            # best-effort coerce; if it fails let pipeline handle it and return a sensible error
            pass

    try:
        proba = pipeline.predict_proba(X)[0, 1]
        pred = int(proba >= 0.5)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Prediction failed: {e}')

    # Build response
    resp = { 'probability': float(proba), 'risk_class': int(pred) }

    # If client requested an echo, include the received features and request headers
    try:
        echo = request.headers.get('x-echo-payload')
        if echo and str(echo).lower() in ('1', 'true', 'yes'):
            # include the features and a subset of headers for inspection
            hdrs = dict(request.headers)
            resp['echo'] = {
                'received_features': req.features,
                'received_headers': hdrs,
            }
    except Exception:
        # don't fail prediction because echoing failed
        pass

    return resp
