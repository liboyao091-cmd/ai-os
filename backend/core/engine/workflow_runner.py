"""WorkflowRunner — executes workflow / ai_workflow / copilot executor types."""
from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from backend.core.engine.context import RunContext
from backend.core.guardrails.validator import GuardrailViolation


class HumanConfirmRequired(Exception):
    """
    Raised when a human_confirm step is reached.
    Carries the full accumulated state and steps_log so the API layer
    can persist them and resume correctly after user confirmation.
    """
    def __init__(
        self,
        message: str,
        step_id: str,
        state: Optional[Dict[str, Any]] = None,
        steps_log: Optional[List[Dict[str, Any]]] = None,
        total_tokens: int = 0,
    ):
        super().__init__(message)
        self.message = message
        self.step_id = step_id
        self.state = state or {}
        self.steps_log = steps_log or []
        self.total_tokens = total_tokens


@dataclass
class StepResult:
    output: Any
    output_key: Optional[str]
    input_snapshot: Any
    tokens: int
    branch: Optional[bool] = None


@dataclass
class RunResult:
    output: Any
    steps_log: List[Dict[str, Any]] = field(default_factory=list)
    total_tokens: int = 0


_TEMPLATE_RE = re.compile(r"\{\{([^}]+)\}\}")


def _resolve_value(expr: str, state: Dict[str, Any]) -> Any:
    """Resolve a dotted path expression against state, e.g. 'ab_data.p_value'."""
    parts = expr.strip().split(".")
    val: Any = state
    for part in parts:
        if isinstance(val, dict):
            val = val.get(part)
        else:
            try:
                val = getattr(val, part)
            except AttributeError:
                val = None
        if val is None:
            break
    return val


def _resolve_template(template: Any, state: Dict[str, Any]) -> Any:
    """Replace {{expr}} placeholders in strings or recursively in dicts/lists."""
    if isinstance(template, str):
        def replacer(m):
            resolved = _resolve_value(m.group(1), state)
            if resolved is None:
                return m.group(0)
            if isinstance(resolved, (dict, list)):
                return json.dumps(resolved, ensure_ascii=False)
            return str(resolved)
        return _TEMPLATE_RE.sub(replacer, template)
    elif isinstance(template, dict):
        return {k: _resolve_template(v, state) for k, v in template.items()}
    elif isinstance(template, list):
        return [_resolve_template(item, state) for item in template]
    return template


def _safe_eval(condition: str, state: Dict[str, Any]) -> bool:
    """Safely evaluate a condition expression with state values available."""
    flat: Dict[str, Any] = {}
    for k, v in state.items():
        flat[k] = v
        if isinstance(v, dict):
            for sub_k, sub_v in v.items():
                flat[f"{k}.{sub_k}"] = sub_v

    resolved_condition = _resolve_template(condition, state)
    try:
        return bool(eval(resolved_condition, {"__builtins__": {}}, flat))  # noqa: S307
    except Exception:
        return False


class WorkflowRunner:
    """
    Executes workflow / ai_workflow / copilot types.

    When a human_confirm step is hit, raises HumanConfirmRequired with the
    full accumulated state and steps_log attached so the API layer can
    persist them and resume correctly after user confirmation.
    """

    def run(
        self,
        definition: Dict[str, Any],
        input_data: Dict[str, Any],
        ctx: RunContext,
        resume_from_step: Optional[str] = None,
        resume_state: Optional[Dict[str, Any]] = None,
    ) -> RunResult:
        steps_map = {s["step_id"]: s for s in definition.get("steps", [])}
        # When resuming, start from the full persisted state; fresh run uses only input
        state = dict(resume_state) if resume_state is not None else {"input": input_data}
        steps_log: List[Dict[str, Any]] = []
        total_tokens = 0

        if resume_from_step:
            current = self._get_next_after(resume_from_step, steps_map, state)
        else:
            current = self._find_entry_steps(steps_map)

        max_steps = ctx.guardrails.rules.get("execution", {}).get("max_steps", 50)
        executed = 0

        while current and executed < max_steps:
            next_ids: List[str] = []
            for step_id in current:
                if step_id not in steps_map:
                    continue
                step = steps_map[step_id]
                t0 = time.time()
                ctx.guardrails.validate_step(step, state)

                try:
                    result = self._execute_step(step, state, ctx)
                except HumanConfirmRequired as hcr:
                    # Enrich with full execution context before propagating to API layer
                    hcr.state = dict(state)
                    hcr.steps_log = list(steps_log)
                    hcr.total_tokens = total_tokens
                    raise

                if result.output_key:
                    state[result.output_key] = result.output

                log_entry = {
                    "step_id": step_id,
                    "name": step.get("name", step_id),
                    "type": step["type"],
                    "input": result.input_snapshot,
                    "output": result.output,
                    "duration_ms": int((time.time() - t0) * 1000),
                    "tokens": result.tokens,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "state_after": dict(state),
                }
                steps_log.append(log_entry)
                total_tokens += result.tokens

                next_ids.extend(self._resolve_next(step, state, result))
                executed += 1

            current = next_ids

        output_key = definition.get("output_key")
        output = state.get(output_key, state) if output_key else state

        return RunResult(output=output, steps_log=steps_log, total_tokens=total_tokens)

    def _execute_step(self, step: Dict[str, Any], state: Dict[str, Any], ctx: RunContext) -> StepResult:
        match step["type"]:
            case "tool_call":
                resolved = _resolve_template(step.get("input_mapping", {}), state)
                tool_id = str(step["tool_id"])
                if tool_id not in ctx.tools:
                    raise ValueError(f"Tool {tool_id} not loaded in context")
                output = ctx.tools[tool_id].invoke(resolved)
                return StepResult(
                    output=output,
                    output_key=step.get("output_key"),
                    input_snapshot=resolved,
                    tokens=0,
                )

            case "llm_generate":
                prompt = _resolve_template(step.get("prompt_template", ""), state)
                if step.get("use_knowledge") and ctx.knowledge_space_ids:
                    query_key = step.get("knowledge_query_key", "")
                    query = str(state.get(query_key, prompt))
                    retrieved = ctx.rag.retrieve(query, ctx.knowledge_space_ids)
                    if retrieved:
                        prompt = f"参考资料：\n{retrieved}\n\n{prompt}"
                resp = ctx.llm_gateway.complete([{"role": "user", "content": prompt}])
                return StepResult(
                    output=resp.text,
                    output_key=step.get("output_key"),
                    input_snapshot={"prompt": prompt},
                    tokens=resp.tokens,
                )

            case "condition":
                result = _safe_eval(step.get("condition", "false"), state)
                return StepResult(
                    output=result,
                    output_key=None,
                    input_snapshot={"condition": step.get("condition")},
                    tokens=0,
                    branch=result,
                )

            case "human_confirm":
                message = _resolve_template(step.get("message_template", "请确认"), state)
                # State and steps_log are attached in the outer run() loop
                raise HumanConfirmRequired(message=message, step_id=step["step_id"])

            case "sub_executor":
                sub_input = _resolve_template(step.get("input_mapping", {}), state)
                from backend.core.engine.executor_service import run_executor_inline
                sub_result = run_executor_inline(step["executor_id"], sub_input, ctx)
                return StepResult(
                    output=sub_result.output,
                    output_key=step.get("output_key"),
                    input_snapshot=sub_input,
                    tokens=sub_result.total_tokens,
                )

            case _:
                raise ValueError(f"Unknown step type: {step['type']}")

    def _find_entry_steps(self, steps_map: Dict[str, Any]) -> List[str]:
        all_ids = set(steps_map.keys())
        referenced: set = set()
        for step in steps_map.values():
            for key in ("next", "next_true", "next_false", "next_on_confirm", "next_on_reject"):
                for nxt in step.get(key, []):
                    referenced.add(nxt)
        return list(all_ids - referenced) or list(all_ids)[:1]

    def _get_next_after(
        self, step_id: str, steps_map: Dict[str, Any], state: Dict[str, Any]
    ) -> List[str]:
        step = steps_map.get(step_id)
        if not step:
            return []
        return step.get("next_on_confirm", step.get("next", []))

    def _resolve_next(
        self, step: Dict[str, Any], state: Dict[str, Any], result: StepResult
    ) -> List[str]:
        match step["type"]:
            case "condition":
                return step.get("next_true", []) if result.branch else step.get("next_false", [])
            case "human_confirm":
                return []
            case _:
                return step.get("next", [])
