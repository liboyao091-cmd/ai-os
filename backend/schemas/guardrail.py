from pydantic import BaseModel
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime


class GuardrailCreate(BaseModel):
    name: str
    visibility: str = "private"
    rules: Dict[str, Any] = {}


class GuardrailUpdate(BaseModel):
    name: Optional[str] = None
    visibility: Optional[str] = None
    rules: Optional[Dict[str, Any]] = None


class GuardrailRead(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    visibility: str
    rules: Dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}
