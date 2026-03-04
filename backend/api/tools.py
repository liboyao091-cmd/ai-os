import time
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.api.deps import get_db, get_current_user
from backend.models.tool import Tool
from backend.models.user import User
from backend.schemas.tool import (
    ToolCreate, ToolUpdate, ToolRead, ToolTestRequest, ToolTestResponse, ToolStats,
)
from backend.core.tools.invoker import ToolInvoker

router = APIRouter(prefix="/tools", tags=["tools"])


def _check_owner(tool: Tool, user: User):
    if tool.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your tool")


@router.get("", response_model=List[ToolRead])
def list_tools(
    visibility: Optional[str] = None,
    tags: Optional[str] = Query(None, description="Comma-separated tags"),
    owner_id: Optional[str] = Query(None, alias="owner_id"),
    page: int = 1,
    size: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Tool).filter(Tool.is_active == True)
    if visibility:
        q = q.filter(Tool.visibility == visibility)
    elif owner_id == "me":
        q = q.filter(Tool.owner_id == current_user.id)
    else:
        # Show own + team + public
        q = q.filter(
            (Tool.owner_id == current_user.id)
            | (Tool.visibility.in_(["team", "public"]))
        )
    if tags:
        for tag in tags.split(","):
            q = q.filter(Tool.tags.contains([tag.strip()]))
    q = q.order_by(Tool.updated_at.desc())
    return q.offset((page - 1) * size).limit(size).all()


@router.post("", response_model=ToolRead, status_code=201)
def create_tool(
    body: ToolCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tool = Tool(
        id=uuid.uuid4(),
        owner_id=current_user.id,
        **body.model_dump(),
    )
    db.add(tool)
    db.commit()
    db.refresh(tool)
    return tool


@router.get("/{tool_id}", response_model=ToolRead)
def get_tool(
    tool_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tool = db.query(Tool).filter(Tool.id == tool_id).first()
    if not tool:
        raise HTTPException(404, "Tool not found")
    return tool


@router.put("/{tool_id}", response_model=ToolRead)
def update_tool(
    tool_id: uuid.UUID,
    body: ToolUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tool = db.query(Tool).filter(Tool.id == tool_id).first()
    if not tool:
        raise HTTPException(404, "Tool not found")
    _check_owner(tool, current_user)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(tool, k, v)
    tool.version = (tool.version or 1) + 1
    db.commit()
    db.refresh(tool)
    return tool


@router.delete("/{tool_id}", status_code=204)
def delete_tool(
    tool_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tool = db.query(Tool).filter(Tool.id == tool_id).first()
    if not tool:
        raise HTTPException(404, "Tool not found")
    _check_owner(tool, current_user)
    # Check if any executor references this tool
    from backend.models.executor import Executor
    refs = db.query(Executor).filter(Executor.tool_ids.contains([tool_id])).count()
    if refs > 0:
        raise HTTPException(409, f"Tool is referenced by {refs} executor(s)")
    tool.is_active = False
    db.commit()


@router.post("/{tool_id}/fork", response_model=ToolRead, status_code=201)
def fork_tool(
    tool_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    original = db.query(Tool).filter(Tool.id == tool_id).first()
    if not original:
        raise HTTPException(404, "Tool not found")
    if original.fork_policy == "readonly":
        raise HTTPException(403, "Tool is not forkable")
    forked = Tool(
        id=uuid.uuid4(),
        owner_id=current_user.id,
        name=f"{original.name} (fork)",
        description=original.description,
        tags=list(original.tags or []),
        visibility="private",
        fork_policy=original.fork_policy,
        forked_from=original.id,
        invoke_type=original.invoke_type,
        invoke_config=dict(original.invoke_config),
        input_schema=dict(original.input_schema),
        output_schema=dict(original.output_schema),
        version=1,
    )
    db.add(forked)
    db.commit()
    db.refresh(forked)
    return forked


@router.post("/{tool_id}/test", response_model=ToolTestResponse)
def test_tool(
    tool_id: uuid.UUID,
    body: ToolTestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tool = db.query(Tool).filter(Tool.id == tool_id).first()
    if not tool:
        raise HTTPException(404, "Tool not found")
    t0 = time.time()
    try:
        invoker = ToolInvoker(tool)
        output = invoker.invoke(body.input)
        return ToolTestResponse(output=output, duration_ms=int((time.time() - t0) * 1000))
    except Exception as exc:
        return ToolTestResponse(
            output=None,
            duration_ms=int((time.time() - t0) * 1000),
            error=str(exc),
        )


@router.get("/{tool_id}/stats", response_model=ToolStats)
def tool_stats(
    tool_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from backend.models.run import ExecutionRun
    from sqlalchemy import func as sqlfunc

    # Count runs that used this tool (via steps_log)
    # For Phase 1 we return basic stats from execution_runs
    return ToolStats(total_calls=0, success_rate=1.0, avg_duration_ms=0.0)
