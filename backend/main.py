from __future__ import annotations
import os
from typing import Optional
import pandas as pd
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.schemas import (
    PredictRequest, PredictResponse,
    CounterfactualRequest, CounterfactualResponse,
    BatchCounterfactualRequest, SlackTriggerRequest,
    MetadataResponse, ExplainResponse, FeatureImportance
)
from backend.model import load_model, predict_proba, get_feature_importance, FEATURE_COLS
from backend.counterfactual import apply_counterfactual

BASE_CUSTOMERS_CSV = os.getenv("BASE_CUSTOMERS_CSV", os.path.join(os.path.dirname(__file__), "..", "outputs", "customers_base.csv"))
TRAIN_CSV = os.path.join(os.path.dirname(__file__), "..", "outputs", "train_churn_synth.csv")
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")

app = FastAPI(title="Counterfactual Command Center API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve extension UI from the same app (recommended for hackathon/demo)
EXT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "extension"))
if os.path.isdir(EXT_DIR):
    app.mount("/extension", StaticFiles(directory=EXT_DIR, html=True), name="extension")

_model = None
_base_df: Optional[pd.DataFrame] = None

def get_model():
    global _model
    if _model is None:
        _model = load_model()
    return _model

def get_base_df():
    global _base_df
    if _base_df is None:
        if not os.path.exists(BASE_CUSTOMERS_CSV):
            raise FileNotFoundError(f"Base customers not found at {BASE_CUSTOMERS_CSV}. Run scripts/run_demo.py first.")
        _base_df = pd.read_csv(BASE_CUSTOMERS_CSV)
    return _base_df

@app.get("/")
def root():
    """Root endpoint - API is running"""
    return {
        "message": "Counterfactual Command Center API",
        "status": "running",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "metadata": "/metadata/features, /metadata/customers",
            "prediction": "/predict, /predict/explain",
            "counterfactual": "/counterfactual, /batch_counterfactual",
            "actions": "/action/trigger"
        }
    }

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/metadata/features", response_model=MetadataResponse)
def get_features():
    model = get_model()
    importances = get_feature_importance(model, TRAIN_CSV)
    return MetadataResponse(features=[FeatureImportance(**i) for i in importances])

@app.get("/metadata/customers")
def list_customers():
    base = get_base_df()
    return {"customer_ids": base["customer_id"].tolist()}

@app.post("/predict/explain", response_model=ExplainResponse)
def explain(req: PredictRequest):
    model = get_model()
    df = pd.DataFrame([req.model_dump()])
    p = float(predict_proba(model, df)[0])
    
    # For local explanation, we'll just return global for now 
    # but could be improved with SHAP
    importances = get_feature_importance(model, TRAIN_CSV)
    
    return ExplainResponse(
        customer_id=req.customer_id,
        base_risk=p,
        features=[FeatureImportance(**i) for i in importances]
    )

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    model = get_model()
    df = pd.DataFrame([req.model_dump()])
    p = float(predict_proba(model, df)[0])
    return PredictResponse(customer_id=req.customer_id, churn_risk=p)

@app.get("/customer/{customer_id}", response_model=PredictRequest)
def get_customer(customer_id: int):
    base = get_base_df()
    row = base.loc[base["customer_id"] == customer_id]
    if row.empty:
        raise HTTPException(status_code=404, detail="customer_id not found")
    
    # Convert single row to dict and return
    data = row.iloc[0].to_dict()
    return PredictRequest(**data)

@app.post("/counterfactual", response_model=CounterfactualResponse)
def counterfactual(req: CounterfactualRequest):
    model = get_model()
    base = get_base_df()

    row = base.loc[base["customer_id"] == req.customer_id]
    if row.empty:
        raise HTTPException(status_code=404, detail="customer_id not found")

    base_p = float(predict_proba(model, row)[0])
    cf_row = apply_counterfactual(row, req.timing_days, req.action_type)
    cf_p = float(predict_proba(model, cf_row)[0])

    delta = base_p - cf_p
    saved = bool((base_p >= 0.5) and (cf_p < 0.5))

    return CounterfactualResponse(
        customer_id=req.customer_id,
        timing_days=req.timing_days,
        action_type=req.action_type,
        churn_risk_base=base_p,
        churn_risk_counterfactual=cf_p,
        delta_risk=delta,
        saved=saved,
    )

@app.post("/batch_counterfactual")
def batch_counterfactual(req: BatchCounterfactualRequest):
    model = get_model()
    base = get_base_df()

    out = base.copy()
    out["churn_risk_base"] = predict_proba(model, out)

    cf = apply_counterfactual(out, req.timing_days, req.action_type)
    out["churn_risk_counterfactual"] = predict_proba(model, cf)
    out["delta_risk"] = out["churn_risk_base"] - out["churn_risk_counterfactual"]
    out["saved"] = (out["churn_risk_base"] >= 0.5) & (out["churn_risk_counterfactual"] < 0.5)
    out["regret_score"] = out["delta_risk"] * out["arpu"] * 12.0

    out = out.sort_values(["regret_score","delta_risk"], ascending=False).head(req.top_n or 50)
    return {"timing_days": req.timing_days, "action_type": req.action_type, "rows": out.to_dict(orient="records")}

@app.post("/action/trigger")
def trigger_action(req: SlackTriggerRequest):
    if not SLACK_WEBHOOK_URL:
        raise HTTPException(status_code=400, detail="SLACK_WEBHOOK_URL not set")

    payload = {
        "text": "Counterfactual Command Center: Retention action requested",
        "blocks": [
            {"type":"section","text":{"type":"mrkdwn","text":f"*Action:* {req.action_type}  |  *Timing:* {req.timing_days} days earlier"}},
            {"type":"section","text":{"type":"mrkdwn","text":"*Customers:* " + ", ".join(map(str, req.customer_ids))}},
        ],
    }
    r = requests.post(SLACK_WEBHOOK_URL, json=payload, timeout=10)
    if r.status_code >= 300:
        raise HTTPException(status_code=502, detail=f"Slack webhook failed: {r.status_code} {r.text[:200]}")
    return {"ok": True}
