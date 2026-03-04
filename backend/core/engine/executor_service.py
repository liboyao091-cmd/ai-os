"""
Executor service — loads an executor from DB and runs it.
Used by the API layer and by sub_executor steps.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from backend.core.engine.context import RunContext
from backend.core.engine.workflow_runner import RunResult, WorkflowRunner
from backend.core.engine.agent_runner import AgentRunner
from backend.core.tools.invoker import ToolInvoker
from backend.core.llm.gateway import LLMGateway
from backend.core.rag.retriever import RAGRetriever
from backend.core.guardrails.validator import GuardrailValidator


def build_context(executor, db, user_id: str, run_id: str, is_sandbox: bool = False) -> RunContext:
    """Build a RunContext from a loaded Executor ORM object."""
    # Load tools
    tools: Dict[str, ToolInvoker] = {}
    if executor.tool_ids:
        from backend.models.tool import Tool
        for tid in executor.tool_ids:
            tool = db.query(Tool).filter(Tool.id == tid).first()
            if tool:
                tools[str(tid)] = ToolInvoker(tool)

    # Load model policy
    model_policy: Dict[str, Any] = {}
    if executor.model_policy_id:
        from backend.models.model_policy import ModelPolicy
        policy = db.query(ModelPolicy).filter(ModelPolicy.id == executor.model_policy_id).first()
        if policy:
            model_policy = {
                "default_model": policy.default_model,
                "routing_rules": policy.routing_rules or [],
                "fallback_chain": policy.fallback_chain or [],
                "params_override": policy.params_override or {},
            }

    # Load guardrail
    guardrail_rules: Dict[str, Any] = {}
    if executor.guardrail_id:
        from backend.models.guardrail import GuardrailRuleset
        gr = db.query(GuardrailRuleset).filter(GuardrailRuleset.id == executor.guardrail_id).first()
        if gr:
            guardrail_rules = gr.rules or {}

    # Build knowledge IDs as strings
    knowledge_ids = [str(kid) for kid in (executor.knowledge_ids or [])]

    llm = LLMGateway(model_policy=model_policy)
    rag = RAGRetriever(db=db, llm_gateway=llm)
    guardrails = GuardrailValidator(rules=guardrail_rules)

    return RunContext(
        run_id=run_id,
        user_id=user_id,
        tools=tools,
        knowledge_space_ids=knowledge_ids,
        llm_gateway=llm,
        rag=rag,
        guardrails=guardrails,
        is_sandbox=is_sandbox,
    )


def run_executor_inline(executor_id: str, input_data: Dict[str, Any], ctx: RunContext) -> RunResult:
    """
    Run a sub-executor inline (within the same thread/process).
    Used by sub_executor step type.
    """
    from backend.db.session import SessionLocal
    from backend.models.executor import Executor

    db = SessionLocal()
    try:
        executor = db.query(Executor).filter(Executor.id == uuid.UUID(executor_id)).first()
        if not executor:
            raise ValueError(f"Executor {executor_id} not found")
        sub_ctx = build_context(executor, db, ctx.user_id, ctx.run_id, ctx.is_sandbox)
        return _dispatch_runner(executor, input_data, sub_ctx)
    finally:
        db.close()


def _dispatch_runner(executor, input_data: Dict[str, Any], ctx: RunContext) -> RunResult:
    match executor.executor_type:
        case "workflow" | "ai_workflow" | "copilot":
            return WorkflowRunner().run(executor.definition, input_data, ctx)
        case "agent" | "multi_agent":
            return AgentRunner().run(executor.definition, input_data, ctx)
        case _:
            raise ValueError(f"Unknown executor_type: {executor.executor_type}")
