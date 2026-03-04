import time
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.api.deps import get_db, get_current_user
from backend.models.executor import Executor
from backend.models.run import ExecutionRun
from backend.models.user import User
from backend.schemas.executor import (
    ExecutorCreate, ExecutorUpdate, ExecutorRead,
    ExecutorRunRequest, ExecutorRunResponse, HumanConfirmRequest,
)
from backend.core.engine.executor_service import build_context, _dispatch_runner
from backend.core.engine.workflow_runner import HumanConfirmRequired, WorkflowRunner

router = APIRouter(prefix="/executors", tags=["executors"])

SYNC_TIMEOUT = 30  # seconds for synchronous run


@router.get("", response_model=List[ExecutorRead])
def list_executors(
    visibility: Optional[str] = None,
    executor_type: Optional[str] = None,
    tags: Optional[str] = Query(None),
    page: int = 1,
    size: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Executor).filter(Executor.is_active == True)
    if visibility:
        q = q.filter(Executor.visibility == visibility)
    else:
        q = q.filter(
            (Executor.owner_id == current_user.id)
            | (Executor.visibility.in_(["team", "public"]))
        )
    if executor_type:
        q = q.filter(Executor.executor_type == executor_type)
    if tags:
        for tag in tags.split(","):
            q = q.filter(Executor.tags.contains([tag.strip()]))
    q = q.order_by(Executor.updated_at.desc())
    return q.offset((page - 1) * size).limit(size).all()


@router.post("", response_model=ExecutorRead, status_code=201)
def create_executor(
    body: ExecutorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = body.model_dump()
    data["tool_ids"] = [uuid.UUID(str(tid)) for tid in data.get("tool_ids", [])]
    data["knowledge_ids"] = [uuid.UUID(str(kid)) for kid in data.get("knowledge_ids", [])]
    executor = Executor(id=uuid.uuid4(), owner_id=current_user.id, **data)
    db.add(executor)
    db.commit()
    db.refresh(executor)
    return executor


@router.get("/{executor_id}", response_model=ExecutorRead)
def get_executor(
    executor_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ex = db.query(Executor).filter(Executor.id == executor_id).first()
    if not ex:
        raise HTTPException(404, "Executor not found")
    return ex


@router.put("/{executor_id}", response_model=ExecutorRead)
def update_executor(
    executor_id: uuid.UUID,
    body: ExecutorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ex = db.query(Executor).filter(Executor.id == executor_id).first()
    if not ex:
        raise HTTPException(404, "Executor not found")
    if ex.owner_id != current_user.id:
        raise HTTPException(403, "Forbidden")
    data = body.model_dump(exclude_unset=True)
    if "tool_ids" in data and data["tool_ids"] is not None:
        data["tool_ids"] = [uuid.UUID(str(t)) for t in data["tool_ids"]]
    if "knowledge_ids" in data and data["knowledge_ids"] is not None:
        data["knowledge_ids"] = [uuid.UUID(str(k)) for k in data["knowledge_ids"]]
    for k, v in data.items():
        setattr(ex, k, v)
    ex.version = (ex.version or 1) + 1
    db.commit()
    db.refresh(ex)
    return ex


@router.delete("/{executor_id}", status_code=204)
def delete_executor(
    executor_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ex = db.query(Executor).filter(Executor.id == executor_id).first()
    if not ex:
        raise HTTPException(404, "Executor not found")
    if ex.owner_id != current_user.id:
        raise HTTPException(403, "Forbidden")
    from backend.models.orchestrator import Orchestrator
    refs = db.query(Orchestrator).filter(Orchestrator.executor_refs.contains([executor_id])).count()
    if refs > 0:
        raise HTTPException(409, f"Executor referenced by {refs} orchestrator(s)")
    ex.is_active = False
    db.commit()


@router.post("/{executor_id}/fork", response_model=ExecutorRead, status_code=201)
def fork_executor(
    executor_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    original = db.query(Executor).filter(Executor.id == executor_id).first()
    if not original:
        raise HTTPException(404, "Executor not found")
    if original.fork_policy == "readonly":
        raise HTTPException(403, "Not forkable")
    forked = Executor(
        id=uuid.uuid4(),
        owner_id=current_user.id,
        name=f"{original.name} (fork)",
        description=original.description,
        tags=list(original.tags or []),
        visibility="private",
        fork_policy=original.fork_policy,
        forked_from=original.id,
        executor_type=original.executor_type,
        definition=dict(original.definition),
        tool_ids=list(original.tool_ids or []),
        knowledge_ids=list(original.knowledge_ids or []),
        model_policy_id=original.model_policy_id,
        guardrail_id=original.guardrail_id,
        input_schema=dict(original.input_schema or {}),
        version=1,
    )
    db.add(forked)
    db.commit()
    db.refresh(forked)
    return forked


def _run_executor(
    executor_id: uuid.UUID,
    body: ExecutorRunRequest,
    db: Session,
    current_user: User,
    is_sandbox: bool,
) -> ExecutorRunResponse:
    ex = db.query(Executor).filter(Executor.id == executor_id).first()
    if not ex:
        raise HTTPException(404, "Executor not found")

    run_id = uuid.uuid4()
    run = ExecutionRun(
        id=run_id,
        executor_id=executor_id,
        triggered_by=current_user.id,
        is_sandbox=is_sandbox,
        input=body.input,
        status="running",
        steps_log=[],
    )
    db.add(run)
    db.commit()

    t0 = time.time()
    try:
        ctx = build_context(ex, db, str(current_user.id), str(run_id), is_sandbox)
        result = _dispatch_runner(ex, body.input, ctx)

        run.status = "success"
        run.output = result.output
        run.steps_log = result.steps_log
        run.total_tokens = result.total_tokens
        run.duration_ms = int((time.time() - t0) * 1000)
        run.finished_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(run)

        return ExecutorRunResponse(
            run_id=run.id,
            status=run.status,
            output=run.output,
            steps_log=run.steps_log,
            total_tokens=run.total_tokens,
            duration_ms=run.duration_ms,
        )

    except HumanConfirmRequired as hcr:
        # Pause execution, store state
        run.status = "waiting_confirm"
        run.paused_step_id = hcr.step_id
        # Save current steps_log and state (state is in the last step's state_after)
        # We need to store the runner's state — we'll store input + all outputs so far
        # For simplicity, store a snapshot in paused_state
        run.steps_log = []  # will be updated when resumed
        run.duration_ms = int((time.time() - t0) * 1000)
        db.commit()
        db.refresh(run)
        return ExecutorRunResponse(
            run_id=run.id,
            status="waiting_confirm",
            output={"confirm_message": hcr.message, "step_id": hcr.step_id},
            steps_log=[],
            total_tokens=0,
        )

    except Exception as exc:
        run.status = "failed"
        run.error_message = str(exc)
        run.duration_ms = int((time.time() - t0) * 1000)
        run.finished_at = datetime.now(timezone.utc)
        db.commit()
        return ExecutorRunResponse(
            run_id=run.id,
            status="failed",
            error_message=str(exc),
        )


@router.post("/{executor_id}/run", response_model=ExecutorRunResponse)
def run_executor_sync(
    executor_id: uuid.UUID,
    body: ExecutorRunRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _run_executor(executor_id, body, db, current_user, is_sandbox=False)


@router.post("/{executor_id}/sandbox", response_model=ExecutorRunResponse)
def run_executor_sandbox(
    executor_id: uuid.UUID,
    body: ExecutorRunRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _run_executor(executor_id, body, db, current_user, is_sandbox=True)


@router.post("/{executor_id}/run/async", response_model=ExecutorRunResponse)
def run_executor_async(
    executor_id: uuid.UUID,
    body: ExecutorRunRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ex = db.query(Executor).filter(Executor.id == executor_id).first()
    if not ex:
        raise HTTPException(404, "Executor not found")

    run_id = uuid.uuid4()
    run = ExecutionRun(
        id=run_id,
        executor_id=executor_id,
        triggered_by=current_user.id,
        is_sandbox=False,
        input=body.input,
        status="running",
        steps_log=[],
    )
    db.add(run)
    db.commit()

    try:
        from backend.tasks.run_executor_async import run_executor_task
        run_executor_task.delay(str(executor_id), str(run_id), body.input, str(current_user.id))
    except Exception:
        pass  # Celery may not be running

    return ExecutorRunResponse(run_id=run_id, status="running")


@router.get("/{executor_id}/runs", response_model=List[ExecutorRunResponse])
def list_executor_runs(
    executor_id: uuid.UUID,
    status: Optional[str] = None,
    page: int = 1,
    size: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(ExecutionRun).filter(ExecutionRun.executor_id == executor_id)
    if status:
        q = q.filter(ExecutionRun.status == status)
    q = q.order_by(ExecutionRun.started_at.desc())
    runs = q.offset((page - 1) * size).limit(size).all()
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


@router.post("/{executor_id}/runs/{run_id}/confirm", response_model=ExecutorRunResponse)
def confirm_human_step(
    executor_id: uuid.UUID,
    run_id: uuid.UUID,
    body: HumanConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = db.query(ExecutionRun).filter(
        ExecutionRun.id == run_id, ExecutionRun.executor_id == executor_id
    ).first()
    if not run:
        raise HTTPException(404, "Run not found")
    if run.status != "waiting_confirm":
        raise HTTPException(400, f"Run is not waiting for confirmation (status={run.status})")

    if not body.confirmed:
        run.status = "cancelled"
        run.finished_at = datetime.now(timezone.utc)
        db.commit()
        return ExecutorRunResponse(run_id=run.id, status="cancelled")

    ex = db.query(Executor).filter(Executor.id == executor_id).first()
    if not ex:
        raise HTTPException(404, "Executor not found")

    t0 = time.time()
    try:
        ctx = build_context(ex, db, str(current_user.id), str(run.id))
        result = WorkflowRunner().run(
            definition=ex.definition,
            input_data=run.input or {},
            ctx=ctx,
            resume_from_step=run.paused_step_id,
            resume_state={"input": run.input or {}},
        )
        run.status = "success"
        run.output = result.output
        run.steps_log = (run.steps_log or []) + result.steps_log
        run.total_tokens = (run.total_tokens or 0) + result.total_tokens
        run.duration_ms = (run.duration_ms or 0) + int((time.time() - t0) * 1000)
        run.finished_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(run)
        return ExecutorRunResponse(
            run_id=run.id,
            status=run.status,
            output=run.output,
            steps_log=run.steps_log,
            total_tokens=run.total_tokens,
            duration_ms=run.duration_ms,
        )
    except Exception as exc:
        run.status = "failed"
        run.error_message = str(exc)
        run.finished_at = datetime.now(timezone.utc)
        db.commit()
        return ExecutorRunResponse(run_id=run.id, status="failed", error_message=str(exc))
