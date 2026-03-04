from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from uuid import UUID
from datetime import datetime


class ExecutorBase(BaseModel):
    name: str
    description: Optional[str] = None
    tags: List[str] = []
    visibility: str = "private"
    fork_policy: str = "forkable"
    executor_type: str
    definition: Dict[str, Any]
    tool_ids: List[UUID] = []
    knowledge_ids: List[UUID] = []
    model_policy_id: Optional[UUID] = None
    guardrail_id: Optional[UUID] = None
    input_schema: Dict[str, Any] = Field(
        default={"type": "object", "properties": {}}
    )


class ExecutorCreate(ExecutorBase):
    pass


class ExecutorUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    visibility: Optional[str] = None
    fork_policy: Optional[str] = None
    definition: Optional[Dict[str, Any]] = None
    tool_ids: Optional[List[UUID]] = None
    knowledge_ids: Optional[List[UUID]] = None
    model_policy_id: Optional[UUID] = None
    guardrail_id: Optional[UUID] = None
    input_schema: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class ExecutorRead(ExecutorBase):
    id: UUID
    owner_id: UUID
    forked_from: Optional[UUID] = None
    version: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ExecutorRunRequest(BaseModel):
    input: Dict[str, Any] = {}


class ExecutorRunResponse(BaseModel):
    run_id: UUID
    status: str
    output: Optional[Any] = None
    steps_log: List[Dict[str, Any]] = []
    total_tokens: int = 0
    duration_ms: Optional[int] = None
    error_message: Optional[str] = None


class HumanConfirmRequest(BaseModel):
    confirmed: bool
