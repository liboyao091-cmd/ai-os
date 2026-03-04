"""AgentRunner — ReAct loop for agent executor type."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List

from backend.core.engine.context import RunContext
from backend.core.engine.workflow_runner import RunResult
from backend.core.guardrails.validator import GuardrailViolation


class AgentRunner:
    """
    Implements a ReAct (Reason + Act) loop:
      Thought → Action (tool_call) → Observation → repeat until stop.
    """

    def run(
        self,
        definition: Dict[str, Any],
        input_data: Dict[str, Any],
        ctx: RunContext,
    ) -> RunResult:
        from backend.core.engine.workflow_runner import _resolve_template

        system_prompt = _resolve_template(
            definition.get("system_prompt", "You are a helpful data science assistant."),
            {"input": input_data},
        )
        goal = _resolve_template(
            definition.get("goal_prompt_template", "{{input.goal}}"),
            {"input": input_data},
        )

        # Optionally inject RAG context
        memory_config = definition.get("memory_config", {})
        if memory_config.get("use_knowledge") and ctx.knowledge_space_ids:
            retrieved = ctx.rag.retrieve(goal, ctx.knowledge_space_ids)
            if retrieved:
                goal = f"参考知识：\n{retrieved}\n\n任务：{goal}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": goal},
        ]

        steps_log: List[Dict[str, Any]] = []
        total_tokens = 0
        max_steps = ctx.guardrails.rules.get("execution", {}).get("max_steps", 20)
        step_count = 0

        tool_specs = self._build_tool_specs(ctx.tools)

        while step_count < max_steps:
            resp = ctx.llm_gateway.complete(
                messages=messages,
                tools=tool_specs if tool_specs else None,
            )
            total_tokens += resp.tokens

            if resp.finish_reason == "tool_calls" or (
                resp.finish_reason != "stop" and resp.tool_call is not None
            ):
                tc = resp.tool_call
                ctx.guardrails.check_tool_call_budget(steps_log)

                tool_name = tc.name
                # tool_name may be UUID string or friendly name
                tool_invoker = ctx.tools.get(tool_name)
                if not tool_invoker:
                    # fallback: try matching by tool id prefix
                    tool_invoker = next(
                        (t for tid, t in ctx.tools.items() if tid.startswith(tool_name)),
                        None,
                    )
                if not tool_invoker:
                    tool_result = {"error": f"Tool {tool_name} not found"}
                else:
                    try:
                        tool_result = tool_invoker.invoke(tc.arguments)
                    except Exception as exc:
                        tool_result = {"error": str(exc)}

                steps_log.append({
                    "type": "tool_call",
                    "tool": tool_name,
                    "input": tc.arguments,
                    "output": tool_result,
                    "tokens": resp.tokens,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
                messages.append({"role": "assistant", "content": resp.raw_content})
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(tool_result, ensure_ascii=False, default=str),
                })

            elif resp.finish_reason == "stop":
                steps_log.append({
                    "type": "final_answer",
                    "output": resp.text,
                    "tokens": resp.tokens,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
                ctx.guardrails.check_token_budget(total_tokens)
                return RunResult(
                    output=resp.text,
                    steps_log=steps_log,
                    total_tokens=total_tokens,
                )
            else:
                # Unknown finish reason — treat as stop
                steps_log.append({
                    "type": "final_answer",
                    "output": resp.text,
                    "tokens": resp.tokens,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
                return RunResult(output=resp.text, steps_log=steps_log, total_tokens=total_tokens)

            step_count += 1

        raise GuardrailViolation(f"超过最大步骤数 {max_steps}")

    def _build_tool_specs(self, tools: Dict[str, Any]) -> List[Dict[str, Any]]:
        specs = []
        for tid, invoker in tools.items():
            specs.append({
                "type": "function",
                "function": {
                    "name": tid,
                    "description": invoker.description or f"Tool {tid}",
                    "parameters": invoker.input_schema or {"type": "object", "properties": {}},
                },
            })
        return specs
