from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from uuid import UUID
from datetime import datetime


class RunRead(BaseModel):
    id: UUID
    executor_id: Optional[UUID] = None
    orchestrator_id: Optional[UUID] = None
    triggered_by: UUID
    is_sandbox: bool
    input: Dict[str, Any]
    output: Optional[Any] = None
    status: str
    steps_log: List[Dict[str, Any]]
    total_tokens: int
    duration_ms: Optional[int] = None
    error_message: Optional[str] = None
    human_scores: Dict[str, Any]
    started_at: datetime
    finished_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class RunScoreRequest(BaseModel):
    scores: Dict[str, Any]


class ReplayResponse(BaseModel):
    run_id: UUID
    steps: List[Dict[str, Any]]
    total_tokens: int
    duration_ms: Optional[int]
    status: str


class PaginatedRunsResponse(BaseModel):
    items: List[RunRead]
    total: int
    page: int
    size: int
