"""MultiAgentRunner — coordinates multiple agents via a shared message board."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List

from backend.core.engine.context import RunContext
from backend.core.engine.workflow_runner import RunResult
from backend.core.guardrails.validator import GuardrailViolation


class MultiAgentRunner:
    """
    Multi-Agent coordinator pattern:
      1. A coordinator LLM reads the task and assigns subtasks to agents.
      2. Each "agent" has a name, role, and optional tool subset.
      3. Agents are run sequentially; each sees previous agents' outputs.
      4. Coordinator synthesizes final output.
    """

    def run(
        self,
        definition: Dict[str, Any],
        input_data: Dict[str, Any],
        ctx: RunContext,
    ) -> RunResult:
        from backend.core.engine.workflow_runner import _resolve_template

        steps_log: List[Dict[str, Any]] = []
        total_tokens = 0
        agents: List[Dict[str, Any]] = definition.get("agents", [])
        coordinator_prompt = _resolve_template(
            definition.get("coordinator_prompt", "你是多智能体系统的协调者。"),
            {"input": input_data},
        )
        task = _resolve_template(
            definition.get("task_template", "{{input.goal}}"),
            {"input": input_data},
        )

        # If no agents defined, fall back to single-agent ReAct behavior
        if not agents:
            from backend.core.engine.agent_runner import AgentRunner
            return AgentRunner().run(
                {
                    "system_prompt": coordinator_prompt,
                    "goal_prompt_template": task,
                },
                input_data,
                ctx,
            )

        shared_board: List[Dict[str, str]] = []  # [{agent, output}]

        # ── Coordinator planning step ──────────────────────────────────────────
        agent_descs = "\n".join(
            f"- {a.get('name', f'Agent{i+1}')}: {a.get('role', '通用智能体')}"
            for i, a in enumerate(agents)
        )
        plan_prompt = (
            f"{coordinator_prompt}\n\n"
            f"可用智能体：\n{agent_descs}\n\n"
            f"任务：{task}\n\n"
            f"请为每个智能体分配具体子任务（JSON数组，字段：agent_name, subtask）："
        )
        plan_resp = ctx.llm_gateway.complete([
            {"role": "system", "content": coordinator_prompt},
            {"role": "user", "content": plan_prompt},
        ])
        total_tokens += plan_resp.tokens

        # Parse plan (tolerate non-JSON responses)
        subtask_map: Dict[str, str] = {}
        try:
            raw = plan_resp.text
            start = raw.find("[")
            end = raw.rfind("]") + 1
            if start != -1 and end > start:
                assignments = json.loads(raw[start:end])
                for a in assignments:
                    subtask_map[a.get("agent_name", "")] = a.get("subtask", task)
        except Exception:
            pass

        steps_log.append({
            "step_id": "coordinator_plan",
            "type": "coordinator_plan",
            "name": "协调者规划",
            "input": {"task": task, "agents": [a.get("name") for a in agents]},
            "output": {"plan": plan_resp.text, "subtask_map": subtask_map},
            "tokens": plan_resp.tokens,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        # ── Run each agent ─────────────────────────────────────────────────────
        max_steps_per_agent = ctx.guardrails.rules.get("execution", {}).get("max_steps_per_agent", 10)
        tool_specs = self._build_tool_specs(ctx.tools)

        for i, agent_def in enumerate(agents):
            agent_name = agent_def.get("name", f"Agent{i+1}")
            agent_role = agent_def.get("role", "通用数据科学智能体")
            subtask = subtask_map.get(agent_name, task)

            # Build context from shared board
            board_context = ""
            if shared_board:
                board_lines = "\n".join(
                    f"[{e['agent']}]: {e['output'][:500]}" for e in shared_board
                )
                board_context = f"\n\n其他智能体的结果：\n{board_lines}"

            sys_prompt = f"你是 {agent_name}，角色：{agent_role}。请完成分配给你的子任务。"
            messages = [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": f"子任务：{subtask}{board_context}"},
            ]

            agent_steps: List[Dict] = []
            agent_tokens = 0
            step_count = 0
            final_output = ""

            while step_count < max_steps_per_agent:
                resp = ctx.llm_gateway.complete(
                    messages=messages,
                    tools=tool_specs if tool_specs else None,
                )
                agent_tokens += resp.tokens
                total_tokens += resp.tokens

                if resp.tool_call and resp.finish_reason != "stop":
                    tc = resp.tool_call
                    invoker = ctx.tools.get(tc.name)
                    if not invoker:
                        invoker = next(
                            (t for tid, t in ctx.tools.items() if tid.startswith(tc.name)),
                            None,
                        )
                    tool_result = invoker.invoke(tc.arguments) if invoker else {"error": f"Tool {tc.name} not found"}

                    agent_steps.append({
                        "type": "tool_call",
                        "tool": tc.name,
                        "input": tc.arguments,
                        "output": tool_result,
                        "tokens": resp.tokens,
                    })
                    messages.append({"role": "assistant", "content": resp.raw_content or ""})
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": json.dumps(tool_result, ensure_ascii=False, default=str),
                    })
                else:
                    final_output = resp.text
                    agent_steps.append({"type": "final", "output": resp.text, "tokens": resp.tokens})
                    break

                step_count += 1

            shared_board.append({"agent": agent_name, "output": final_output})
            steps_log.append({
                "step_id": f"agent_{i}",
                "type": "agent",
                "name": agent_name,
                "input": {"subtask": subtask},
                "output": {"result": final_output, "steps": agent_steps},
                "tokens": agent_tokens,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

        # ── Coordinator synthesis ──────────────────────────────────────────────
        board_summary = "\n\n".join(
            f"【{e['agent']}】\n{e['output']}" for e in shared_board
        )
        synthesis_messages = [
            {"role": "system", "content": coordinator_prompt},
            {
                "role": "user",
                "content": (
                    f"原始任务：{task}\n\n"
                    f"各智能体完成结果：\n{board_summary}\n\n"
                    f"请综合以上结果，给出最终的完整答案："
                ),
            },
        ]
        synthesis_resp = ctx.llm_gateway.complete(synthesis_messages)
        total_tokens += synthesis_resp.tokens

        steps_log.append({
            "step_id": "coordinator_synthesis",
            "type": "coordinator_synthesis",
            "name": "协调者综合",
            "input": {"agent_results": shared_board},
            "output": {"final": synthesis_resp.text},
            "tokens": synthesis_resp.tokens,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        ctx.guardrails.check_token_budget(total_tokens)
        return RunResult(
            output=synthesis_resp.text,
            steps_log=steps_log,
            total_tokens=total_tokens,
        )

    def _build_tool_specs(self, tools: Dict[str, Any]) -> List[Dict[str, Any]]:
        return [
            {
                "type": "function",
                "function": {
                    "name": tid,
                    "description": invoker.description or f"Tool {tid}",
                    "parameters": invoker.input_schema or {"type": "object", "properties": {}},
                },
            }
            for tid, invoker in tools.items()
        ]
