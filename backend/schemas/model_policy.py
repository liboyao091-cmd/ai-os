from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from uuid import UUID
from datetime import datetime


class ModelPolicyCreate(BaseModel):
    name: str
    visibility: str = "private"
    default_model: str = "doubao-pro"
    routing_rules: List[Dict[str, Any]] = []
    fallback_chain: List[str] = ["doubao-pro"]
    monthly_token_budget: int = 1000000
    params_override: Dict[str, Any] = {}


class ModelPolicyUpdate(BaseModel):
    name: Optional[str] = None
    visibility: Optional[str] = None
    default_model: Optional[str] = None
    routing_rules: Optional[List[Dict[str, Any]]] = None
    fallback_chain: Optional[List[str]] = None
    monthly_token_budget: Optional[int] = None
    params_override: Optional[Dict[str, Any]] = None


class ModelPolicyRead(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    visibility: str
    default_model: str
    routing_rules: List[Dict[str, Any]]
    fallback_chain: List[str]
    monthly_token_budget: int
    params_override: Dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}
