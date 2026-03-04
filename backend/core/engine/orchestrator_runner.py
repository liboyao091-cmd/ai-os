"""OrchestratorRunner — routes and executes across multiple Executors."""
from __future__ import annotations

import uuid
from typing import Any, Dict

from backend.core.engine.workflow_runner import RunResult
from backend.core.engine.executor_service import build_context, _dispatch_runner


class OrchestratorRunner:
    def __init__(self, db, user_id: str):
        self.db = db
        self.user_id = user_id

    def run(self, orchestrator, input_data: Dict[str, Any]) -> RunResult:
        match orchestrator.routing_type:
            case "canvas":
                return self._run_canvas(orchestrator, input_data)
            case "intent_based":
                return self._run_intent_based(orchestrator, input_data)
            case "rule_based":
                return self._run_rule_based(orchestrator, input_data)
            case _:
                raise ValueError(f"Unknown routing_type: {orchestrator.routing_type}")

    def _run_canvas(self, orchestrator, input_data: Dict[str, Any]) -> RunResult:
        """Sequential canvas: follow edges from entry_node to output_node."""
        definition = orchestrator.definition
        nodes = {n["node_id"]: n for n in definition.get("nodes", [])}
        edges = definition.get("edges", [])

        # Build adjacency + mapping
        adjacency: Dict[str, list] = {nid: [] for nid in nodes}
        edge_mappings: Dict[str, Dict[str, str]] = {}
        for edge in edges:
            adjacency[edge["from"]].append(edge["to"])
            edge_mappings[f"{edge['from']}->{edge['to']}"] = edge.get("mapping", {})

        entry = definition.get("entry_node")
        if not entry:
            entry = list(nodes.keys())[0]

        state: Dict[str, Any] = {"input": input_data}
        current_node_id = entry
        all_steps: list = []
        total_tokens = 0

        visited = set()
        while current_node_id and current_node_id not in visited:
            visited.add(current_node_id)
            node = nodes.get(current_node_id)
            if not node:
                break

            executor_id = node.get("executor_id")
            from backend.models.executor import Executor
            ex = self.db.query(Executor).filter(Executor.id == uuid.UUID(executor_id)).first()
            if not ex:
                break

            run_id = str(uuid.uuid4())
            ctx = build_context(ex, self.db, self.user_id, run_id)
            result = _dispatch_runner(ex, state, ctx)

            state[f"node_{current_node_id}"] = result.output
            all_steps.extend(result.steps_log)
            total_tokens += result.total_tokens

            # Move to next node
            next_nodes = adjacency.get(current_node_id, [])
            current_node_id = next_nodes[0] if next_nodes else None

        output_node = definition.get("output_node")
        output = state.get(f"node_{output_node}", state) if output_node else state

        return RunResult(output=output, steps_log=all_steps, total_tokens=total_tokens)

    def _run_intent_based(self, orchestrator, input_data: Dict[str, Any]) -> RunResult:
        """LLM-based intent routing."""
        definition = orchestrator.definition
        intent_prompt_template = definition.get("intent_prompt", "")
        routes = definition.get("routes", [])
        fallback_executor_id = definition.get("fallback_executor_id")

        from backend.core.llm.gateway import LLMGateway
        from backend.core.engine.workflow_runner import _resolve_template

        prompt = _resolve_template(intent_prompt_template, {"input": input_data})
        llm = LLMGateway()
        resp = llm.complete([{"role": "user", "content": prompt}])
        detected_intent = (resp.text or "").strip().lower()

        target_executor_id = fallback_executor_id
        for route in routes:
            if route.get("intent", "").lower() in detected_intent:
                target_executor_id = route["executor_id"]
                break

        if not target_executor_id:
            return RunResult(output={"error": "No matching route found"})

        from backend.models.executor import Executor
        ex = self.db.query(Executor).filter(
            Executor.id == uuid.UUID(str(target_executor_id))
        ).first()
        if not ex:
            return RunResult(output={"error": f"Executor {target_executor_id} not found"})

        run_id = str(uuid.uuid4())
        ctx = build_context(ex, self.db, self.user_id, run_id)
        return _dispatch_runner(ex, input_data, ctx)

    def _run_rule_based(self, orchestrator, input_data: Dict[str, Any]) -> RunResult:
        """Rule-based routing: evaluate condition expressions."""
        definition = orchestrator.definition
        routes = definition.get("routes", [])
        fallback_executor_id = definition.get("fallback_executor_id")

        from backend.core.engine.workflow_runner import _safe_eval

        target_executor_id = fallback_executor_id
        for route in routes:
            condition = route.get("condition", "False")
            if _safe_eval(condition, {"input": input_data}):
                target_executor_id = route["executor_id"]
                break

        if not target_executor_id:
            return RunResult(output={"error": "No matching rule"})

        from backend.models.executor import Executor
        ex = self.db.query(Executor).filter(
            Executor.id == uuid.UUID(str(target_executor_id))
        ).first()
        if not ex:
            return RunResult(output={"error": f"Executor not found"})

        run_id = str(uuid.uuid4())
        ctx = build_context(ex, self.db, self.user_id, run_id)
        return _dispatch_runner(ex, input_data, ctx)
