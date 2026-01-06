from __future__ import annotations
import numpy as np
import pandas as pd

PLAN_TIERS = ["basic","standard","premium"]
REGIONS = ["na","emea","apac","latam"]

def sigmoid(x):
    return 1 / (1 + np.exp(-x))

def make_customers(n: int = 8000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    customer_id = np.arange(1000, 1000 + n)
    tenure = rng.gamma(shape=2.0, scale=12.0, size=n).clip(1, 120)
    plan = rng.choice(PLAN_TIERS, size=n, p=[0.45, 0.40, 0.15])
    region = rng.choice(REGIONS, size=n, p=[0.45, 0.25, 0.20, 0.10])

    base_arpu = np.select([plan=="basic", plan=="standard", plan=="premium"], [12.0, 22.0, 45.0])
    arpu = (base_arpu * rng.normal(1.0, 0.12, size=n)).clip(6, 90)

    sessions = rng.normal(18, 7, size=n).clip(0, 60)
    usage_drop = rng.normal(12, 10, size=n).clip(0, 80)
    tickets = rng.poisson(lam=1.2, size=n).astype(float)
    csat = rng.normal(0.78, 0.12, size=n).clip(0.1, 1.0)
    failed_pay = rng.poisson(lam=0.25, size=n).astype(float)

    return pd.DataFrame({
        "customer_id": customer_id,
        "tenure_months": tenure,
        "arpu": arpu,
        "sessions_30d": sessions,
        "usage_drop_30d_pct": usage_drop,
        "tickets_30d": tickets,
        "csat_30d": csat,
        "failed_payments_90d": failed_pay,
        "plan_tier": plan,
        "region": region,
    })

def label_churn(df: pd.DataFrame, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    z = (
        0.028 * df["usage_drop_30d_pct"].values +
        0.55  * df["tickets_30d"].values +
        1.2   * (0.85 - df["csat_30d"].values).clip(0) +
        0.60  * df["failed_payments_90d"].values -
        0.020 * df["sessions_30d"].values -
        0.010 * df["tenure_months"].values +
        0.012 * df["arpu"].values
    )
    z += np.select([df["plan_tier"]=="basic", df["plan_tier"]=="standard", df["plan_tier"]=="premium"], [0.22, 0.05, -0.08])
    z += np.select([df["region"]=="na", df["region"]=="emea", df["region"]=="apac", df["region"]=="latam"], [0.00, 0.04, 0.03, 0.08])

    p = sigmoid(-1.15 + z * 0.55)
    churned = rng.binomial(1, p)
    out = df.copy()
    out["churned"] = churned.astype(int)
    out["churn_prob_true"] = p
    return out
