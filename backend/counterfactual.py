from __future__ import annotations
from dataclasses import dataclass
import pandas as pd

@dataclass(frozen=True)
class ActionEffect:
    usage_boost: float
    ticket_reduction: float
    csat_boost: float
    payment_fix: float

EFFECTS = {
    "none": ActionEffect(0.0, 0.0, 0.0, 0.0),
    "discount": ActionEffect(0.10, 0.05, 0.02, 0.02),
    "priority_support": ActionEffect(0.08, 0.20, 0.06, 0.01),
    "proactive_outreach": ActionEffect(0.15, 0.15, 0.08, 0.03),
}

def timing_multiplier(timing_days: int) -> float:
    if timing_days <= 0:
        return 0.0
    if timing_days <= 7:
        return 0.55
    if timing_days <= 14:
        return 0.75
    if timing_days <= 30:
        return 0.95
    return 1.00

def apply_counterfactual(df: pd.DataFrame, timing_days: int, action_type: str) -> pd.DataFrame:
    out = df.copy()
    m = timing_multiplier(timing_days)
    eff = EFFECTS[action_type]

    out["sessions_30d"] = out["sessions_30d"] * (1.0 + eff.usage_boost * m)
    out["usage_drop_30d_pct"] = (out["usage_drop_30d_pct"] - (eff.usage_boost * 20.0 * m)).clip(0.0, 100.0)

    out["tickets_30d"] = (out["tickets_30d"] * (1.0 - eff.ticket_reduction * m)).clip(lower=0.0)
    out["csat_30d"] = (out["csat_30d"] + eff.csat_boost * m).clip(0.0, 1.0)
    out["failed_payments_90d"] = (out["failed_payments_90d"] * (1.0 - eff.payment_fix * m)).clip(lower=0.0)
    return out
