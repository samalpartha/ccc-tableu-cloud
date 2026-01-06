from __future__ import annotations
import os
import joblib
import pandas as pd
import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.metrics import roc_auc_score
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.model_selection import StratifiedKFold
from sklearn.inspection import permutation_importance

MODEL_PATH = os.getenv("MODEL_PATH", os.path.join(os.path.dirname(__file__), "..", "outputs", "model.joblib"))

NUM_COLS = ["tenure_months","arpu","sessions_30d","usage_drop_30d_pct","tickets_30d","csat_30d","failed_payments_90d"]
CAT_COLS = ["plan_tier","region"]
FEATURE_COLS = NUM_COLS + CAT_COLS

def build_pipeline() -> Pipeline:
    pre = ColumnTransformer([
        ("num", "passthrough", NUM_COLS),
        ("cat", OneHotEncoder(handle_unknown="ignore"), CAT_COLS),
    ])
    clf = HistGradientBoostingClassifier(
        learning_rate=0.06,
        max_depth=6,
        max_iter=500,
        random_state=42,
    )
    return Pipeline([("pre", pre), ("clf", clf)])

def train_and_save(train_csv: str, target_col: str = "churned") -> dict:
    df = pd.read_csv(train_csv)
    X = df[FEATURE_COLS].copy()
    y = df[target_col].astype(int).values

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    oof = np.zeros(len(df))
    for tr, va in skf.split(X, y):
        m = build_pipeline()
        m.fit(X.iloc[tr], y[tr])
        oof[va] = m.predict_proba(X.iloc[va])[:, 1]
    auc = roc_auc_score(y, oof)

    model = build_pipeline()
    model.fit(X, y)

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    return {"cv_auc": float(auc), "model_path": MODEL_PATH}

def load_model() -> Pipeline:
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model not found at {MODEL_PATH}. Run scripts/run_demo.py first.")
    return joblib.load(MODEL_PATH)

def predict_proba(model: Pipeline, df_features: pd.DataFrame) -> np.ndarray:
    return model.predict_proba(df_features[FEATURE_COLS])[:, 1]

def get_feature_importance(model: Pipeline, train_csv: str) -> list:
    df = pd.read_csv(train_csv)
    X = df[FEATURE_COLS]
    y = df["churned"].astype(int)
    
    # Global importance using permutation
    r = permutation_importance(model, X, y, n_repeats=5, random_state=42)
    importances = []
    for i in r.importances_mean.argsort()[::-1]:
        importances.append({
            "feature": FEATURE_COLS[i],
            "importance": float(r.importances_mean[i])
        })
    return importances
