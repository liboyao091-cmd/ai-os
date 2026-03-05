import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.api.deps import get_db, get_current_user
from backend.models.run import ExecutionRun
from backend.models.user import User
from backend.schemas.run import RunRead, RunScoreRequest, ReplayResponse

router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("", response_model=List[RunRead])
def list_runs(
    executor_id: Optional[uuid.UUID] = None,
    orchestrator_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    is_sandbox: Optional[bool] = None,
    page: int = 1,
    size: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List runs for the current user, optionally filtered."""
    q = db.query(ExecutionRun).filter(ExecutionRun.triggered_by == current_user.id)
    if executor_id:
        q = q.filter(ExecutionRun.executor_id == executor_id)
    if orchestrator_id:
        q = q.filter(ExecutionRun.orchestrator_id == orchestrator_id)
    if status:
        q = q.filter(ExecutionRun.status == status)
    if is_sandbox is not None:
        q = q.filter(ExecutionRun.is_sandbox == is_sandbox)
    q = q.order_by(ExecutionRun.started_at.desc())
    return q.offset((page - 1) * size).limit(size).all()


@router.get("/{run_id}", response_model=RunRead)
def get_run(
    run_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = db.query(ExecutionRun).filter(ExecutionRun.id == run_id).first()
    if not run:
        raise HTTPException(404, "Run not found")
    return run


@router.get("/{run_id}/replay", response_model=ReplayResponse)
def replay_run(
    run_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = db.query(ExecutionRun).filter(ExecutionRun.id == run_id).first()
    if not run:
        raise HTTPException(404, "Run not found")
    steps = run.steps_log or []
    steps_sorted = sorted(steps, key=lambda s: s.get("timestamp", ""))
    return ReplayResponse(
        run_id=run.id,
        steps=steps_sorted,
        total_tokens=run.total_tokens or 0,
        duration_ms=run.duration_ms,
        status=run.status,
    )


@router.post("/{run_id}/score", response_model=RunRead)
def score_run(
    run_id: uuid.UUID,
    body: RunScoreRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = db.query(ExecutionRun).filter(ExecutionRun.id == run_id).first()
    if not run:
        raise HTTPException(404, "Run not found")
    existing = dict(run.human_scores or {})
    existing.update(body.scores)
    run.human_scores = existing
    db.commit()
    db.refresh(run)
    return run
