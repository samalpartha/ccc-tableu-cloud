from __future__ import annotations
import os
import pandas as pd
from data.generate import make_customers, label_churn
from backend.model import train_and_save, load_model, predict_proba
from backend.counterfactual import apply_counterfactual

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "outputs")

def ensure_dirs():
    os.makedirs(OUT, exist_ok=True)

def export_scenarios(customers: pd.DataFrame, model):
    base = customers.copy()
    base["churn_risk_base"] = predict_proba(model, base)
    base.to_csv(os.path.join(OUT, "customers_scored_base.csv"), index=False)

    for timing in [0, 7, 14, 30]:
        for action in ["none", "discount", "priority_support", "proactive_outreach"]:
            cf = apply_counterfactual(base, timing, action)
            out = base.copy()
            out["timing_days"] = timing
            out["action_type"] = action
            out["churn_risk_counterfactual"] = predict_proba(model, cf)
            out["delta_risk"] = out["churn_risk_base"] - out["churn_risk_counterfactual"]
            out["saved"] = (out["churn_risk_base"] >= 0.5) & (out["churn_risk_counterfactual"] < 0.5)
            out["regret_score"] = out["delta_risk"] * out["arpu"] * 12.0
            out.to_csv(os.path.join(OUT, f"customers_scored_t{timing}_{action}.csv"), index=False)

def main():
    ensure_dirs()
    customers = make_customers(n=8000, seed=42)
    train = label_churn(customers, seed=42)

    train.to_csv(os.path.join(OUT, "train_churn_synth.csv"), index=False)
    customers.to_csv(os.path.join(OUT, "customers_base.csv"), index=False)

    info = train_and_save(os.path.join(OUT, "train_churn_synth.csv"))
    print("Training done:", info)

    model = load_model()
    export_scenarios(customers, model)
    print("Scenario CSVs written to:", OUT)

if __name__ == "__main__":
    main()
