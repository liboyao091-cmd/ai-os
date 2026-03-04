import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.deps import get_db, get_current_user
from backend.models.run import ExecutionRun
from backend.models.user import User
from backend.schemas.run import RunRead, RunScoreRequest, ReplayResponse

router = APIRouter(prefix="/runs", tags=["runs"])


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
    # Sort by timestamp if present
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
