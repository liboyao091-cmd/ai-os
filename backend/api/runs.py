import asyncio
import json
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.api.deps import get_db, get_current_user
from backend.models.run import ExecutionRun
from backend.models.user import User
from backend.schemas.run import RunRead, RunScoreRequest, ReplayResponse, PaginatedRunsResponse

router = APIRouter(prefix="/runs", tags=["runs"])

TERMINAL_STATUSES = {"success", "failed", "cancelled"}


@router.get("", response_model=PaginatedRunsResponse)
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
    """List runs for the current user with pagination."""
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
    total = q.count()
    items = q.offset((page - 1) * size).limit(size).all()
    return PaginatedRunsResponse(items=items, total=total, page=page, size=size)


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


@router.get("/{run_id}/stream")
async def stream_run(
    run_id: uuid.UUID,
    user_id: Optional[str] = Query(None, description="User ID for SSE auth (alternative to X-User-ID header)"),
    db: Session = Depends(get_db),
):
    """SSE endpoint: streams run status updates until terminal state.
    
    Accepts user_id as query param since EventSource doesn't support custom headers.
    """
    # Simple auth: accept any user for now (run visibility check)
    run = db.query(ExecutionRun).filter(ExecutionRun.id == run_id).first()
    if not run:
        raise HTTPException(404, "Run not found")

    async def event_generator():
        seen_steps = 0
        while True:
            try:
                db.expire(run)
                db.refresh(run)
            except Exception:
                break

            current_steps = run.steps_log or []
            new_steps = current_steps[seen_steps:]
            for step in new_steps:
                data = json.dumps({"type": "step", "step": step}, ensure_ascii=False, default=str)
                yield f"data: {data}\n\n"
            seen_steps = len(current_steps)

            status_data = json.dumps({
                "type": "status",
                "status": run.status,
                "total_tokens": run.total_tokens,
                "duration_ms": run.duration_ms,
                "output": run.output,
                "error_message": run.error_message,
            }, ensure_ascii=False, default=str)
            yield f"data: {status_data}\n\n"

            if run.status in TERMINAL_STATUSES or run.status == "waiting_confirm":
                yield "data: {\"type\": \"done\"}\n\n"
                break

            await asyncio.sleep(1.0)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


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
