from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from uuid import UUID
from datetime import datetime


class OrchestratorCreate(BaseModel):
    name: str
    description: Optional[str] = None
    tags: List[str] = []
    visibility: str = "private"
    fork_policy: str = "forkable"
    routing_type: str
    definition: Dict[str, Any]
    executor_refs: List[UUID] = []
    model_policy_id: Optional[UUID] = None


class OrchestratorUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    visibility: Optional[str] = None
    fork_policy: Optional[str] = None
    routing_type: Optional[str] = None
    definition: Optional[Dict[str, Any]] = None
    executor_refs: Optional[List[UUID]] = None
    model_policy_id: Optional[UUID] = None


class OrchestratorRead(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    description: Optional[str] = None
    tags: List[str]
    visibility: str
    fork_policy: str
    forked_from: Optional[UUID] = None
    routing_type: str
    definition: Dict[str, Any]
    executor_refs: List[UUID]
    model_policy_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OrchestratorRunRequest(BaseModel):
    input: Dict[str, Any] = {}
    message: Optional[str] = None
