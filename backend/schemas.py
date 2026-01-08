from typing import List, Literal, Optional
from pydantic import BaseModel, Field

ActionType = Literal["none", "discount", "priority_support", "proactive_outreach"]

class PredictRequest(BaseModel):
    customer_id: int = Field(..., ge=1)
    tenure_months: float
    arpu: float
    sessions_30d: float
    usage_drop_30d_pct: float
    tickets_30d: float
    csat_30d: float
    failed_payments_90d: float
    plan_tier: str
    region: str

class PredictResponse(BaseModel):
    customer_id: int
    churn_risk: float

class CounterfactualRequest(BaseModel):
    customer_id: int = Field(..., ge=1)
    timing_days: int = Field(..., ge=0, le=60)
    action_type: ActionType

class CounterfactualResponse(BaseModel):
    customer_id: int
    timing_days: int
    action_type: ActionType
    churn_risk_base: float
    churn_risk_counterfactual: float
    delta_risk: float
    saved: bool

class BatchCounterfactualRequest(BaseModel):
    timing_days: int = Field(..., ge=0, le=60)
    action_type: ActionType
    top_n: Optional[int] = Field(50, ge=1, le=5000)

class SlackTriggerRequest(BaseModel):
    customer_ids: List[int]
    timing_days: int = Field(..., ge=0, le=60)
    action_type: ActionType

class FeatureImportance(BaseModel):
    feature: str
    importance: float

class MetadataResponse(BaseModel):
    features: List[FeatureImportance]

class ExplainResponse(BaseModel):
    customer_id: int
    base_risk: float
    features: List[FeatureImportance] # Local importance/contributions

class RecommendationResponse(BaseModel):
    customer_id: int
    base_risk: float
    best_action: ActionType
    best_timing: int
    new_risk: float
    improvement: float
    reasoning: str
