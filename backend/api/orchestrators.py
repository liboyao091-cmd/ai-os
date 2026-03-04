import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.deps import get_db, get_current_user
from backend.models.orchestrator import Orchestrator
from backend.models.run import ExecutionRun
from backend.models.user import User
from backend.schemas.orchestrator import (
    OrchestratorCreate, OrchestratorUpdate, OrchestratorRead, OrchestratorRunRequest,
)
from backend.schemas.executor import ExecutorRunResponse

router = APIRouter(prefix="/orchestrators", tags=["orchestrators"])


@router.get("", response_model=List[OrchestratorRead])
def list_orchestrators(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Orchestrator)
        .filter(
            (Orchestrator.owner_id == current_user.id)
            | (Orchestrator.visibility.in_(["team", "public"]))
        )
        .order_by(Orchestrator.updated_at.desc())
        .all()
    )


@router.post("", response_model=OrchestratorRead, status_code=201)
def create_orchestrator(
    body: OrchestratorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = body.model_dump()
    data["executor_refs"] = [uuid.UUID(str(r)) for r in data.get("executor_refs", [])]
    orch = Orchestrator(id=uuid.uuid4(), owner_id=current_user.id, **data)
    db.add(orch)
    db.commit()
    db.refresh(orch)
    return orch


@router.get("/{orch_id}", response_model=OrchestratorRead)
def get_orchestrator(
    orch_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    orch = db.query(Orchestrator).filter(Orchestrator.id == orch_id).first()
    if not orch:
        raise HTTPException(404, "Orchestrator not found")
    return orch


@router.put("/{orch_id}", response_model=OrchestratorRead)
def update_orchestrator(
    orch_id: uuid.UUID,
    body: OrchestratorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    orch = db.query(Orchestrator).filter(Orchestrator.id == orch_id).first()
    if not orch:
        raise HTTPException(404, "Not found")
    if orch.owner_id != current_user.id:
        raise HTTPException(403, "Forbidden")
    data = body.model_dump(exclude_unset=True)
    if "executor_refs" in data and data["executor_refs"] is not None:
        data["executor_refs"] = [uuid.UUID(str(r)) for r in data["executor_refs"]]
    for k, v in data.items():
        setattr(orch, k, v)
    db.commit()
    db.refresh(orch)
    return orch


@router.delete("/{orch_id}", status_code=204)
def delete_orchestrator(
    orch_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    orch = db.query(Orchestrator).filter(Orchestrator.id == orch_id).first()
    if not orch:
        raise HTTPException(404, "Not found")
    if orch.owner_id != current_user.id:
        raise HTTPException(403, "Forbidden")
    db.delete(orch)
    db.commit()


@router.post("/{orch_id}/fork", response_model=OrchestratorRead, status_code=201)
def fork_orchestrator(
    orch_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    original = db.query(Orchestrator).filter(Orchestrator.id == orch_id).first()
    if not original:
        raise HTTPException(404, "Not found")
    if original.fork_policy == "readonly":
        raise HTTPException(403, "Not forkable")
    forked = Orchestrator(
        id=uuid.uuid4(),
        owner_id=current_user.id,
        name=f"{original.name} (fork)",
        description=original.description,
        tags=list(original.tags or []),
        visibility="private",
        fork_policy=original.fork_policy,
        forked_from=original.id,
        routing_type=original.routing_type,
        definition=dict(original.definition),
        executor_refs=list(original.executor_refs or []),
        model_policy_id=original.model_policy_id,
    )
    db.add(forked)
    db.commit()
    db.refresh(forked)
    return forked


@router.post("/{orch_id}/run", response_model=ExecutorRunResponse)
def run_orchestrator(
    orch_id: uuid.UUID,
    body: OrchestratorRunRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    orch = db.query(Orchestrator).filter(Orchestrator.id == orch_id).first()
    if not orch:
        raise HTTPException(404, "Orchestrator not found")

    input_data = body.input or {}
    if body.message:
        input_data["message"] = body.message

    run_id = uuid.uuid4()
    run = ExecutionRun(
        id=run_id,
        orchestrator_id=orch_id,
        triggered_by=current_user.id,
        is_sandbox=False,
        input=input_data,
        status="running",
        steps_log=[],
    )
    db.add(run)
    db.commit()

    try:
        from backend.core.engine.orchestrator_runner import OrchestratorRunner
        result = OrchestratorRunner(db=db, user_id=str(current_user.id)).run(orch, input_data)
        run.status = "success"
        run.output = result.output
        run.steps_log = result.steps_log
        run.total_tokens = result.total_tokens
        from datetime import datetime, timezone
        run.finished_at = datetime.now(timezone.utc)
        db.commit()
        return ExecutorRunResponse(
            run_id=run.id,
            status="success",
            output=run.output,
            steps_log=run.steps_log,
            total_tokens=run.total_tokens,
        )
    except Exception as exc:
        run.status = "failed"
        run.error_message = str(exc)
        from datetime import datetime, timezone
        run.finished_at = datetime.now(timezone.utc)
        db.commit()
        return ExecutorRunResponse(run_id=run.id, status="failed", error_message=str(exc))


@router.get("/{orch_id}/runs", response_model=List[ExecutorRunResponse])
def list_orchestrator_runs(
    orch_id: uuid.UUID,
    page: int = 1,
    size: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    runs = (
        db.query(ExecutionRun)
        .filter(ExecutionRun.orchestrator_id == orch_id)
        .order_by(ExecutionRun.started_at.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )
    return [
        ExecutorRunResponse(
            run_id=r.id,
            status=r.status,
            output=r.output,
            steps_log=r.steps_log or [],
            total_tokens=r.total_tokens or 0,
            duration_ms=r.duration_ms,
            error_message=r.error_message,
        )
        for r in runs
    ]
