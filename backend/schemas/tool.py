from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from uuid import UUID
from datetime import datetime


class ToolBase(BaseModel):
    name: str
    description: Optional[str] = None
    tags: List[str] = []
    visibility: str = "private"
    fork_policy: str = "forkable"
    invoke_type: str
    invoke_config: Dict[str, Any]
    input_schema: Dict[str, Any] = Field(
        default={"type": "object", "properties": {}}
    )
    output_schema: Dict[str, Any] = Field(
        default={"type": "object", "properties": {}}
    )


class ToolCreate(ToolBase):
    pass


class ToolUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    visibility: Optional[str] = None
    fork_policy: Optional[str] = None
    invoke_config: Optional[Dict[str, Any]] = None
    input_schema: Optional[Dict[str, Any]] = None
    output_schema: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class ToolRead(ToolBase):
    id: UUID
    owner_id: UUID
    forked_from: Optional[UUID] = None
    version: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ToolTestRequest(BaseModel):
    input: Dict[str, Any] = {}


class ToolTestResponse(BaseModel):
    output: Any
    duration_ms: int
    error: Optional[str] = None


class ToolStats(BaseModel):
    total_calls: int
    success_rate: float
    avg_duration_ms: float
