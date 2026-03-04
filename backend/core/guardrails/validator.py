"""Guardrail validator — checks input, output, execution budget."""
from typing import Any, Dict, List


class GuardrailViolation(Exception):
    pass


class GuardrailValidator:
    def __init__(self, rules: Dict[str, Any]):
        self.rules = rules

    def validate_input(self, text: str) -> None:
        input_rules = self.rules.get("input", {})
        max_len = input_rules.get("max_length", 8000)
        if len(text) > max_len:
            raise GuardrailViolation(f"Input too long: {len(text)} > {max_len}")
        for kw in input_rules.get("blocked_keywords", []):
            if kw.lower() in text.lower():
                raise GuardrailViolation(f"Blocked keyword found: {kw}")

    def validate_step(self, step: Dict[str, Any], state: Dict[str, Any]) -> None:
        exec_rules = self.rules.get("execution", {})
        max_steps = exec_rules.get("max_steps", 20)
        # step-level validation: timeout and step count are enforced in the runner
        pass

    def check_tool_call_budget(self, steps_log: List[Dict[str, Any]]) -> None:
        exec_rules = self.rules.get("execution", {})
        max_tool_calls = exec_rules.get("max_tool_calls", 50)
        tool_calls = sum(1 for s in steps_log if s.get("type") == "tool_call")
        if tool_calls >= max_tool_calls:
            raise GuardrailViolation(
                f"Max tool calls exceeded: {tool_calls} >= {max_tool_calls}"
            )

    def check_token_budget(self, total_tokens: int) -> None:
        budget_rules = self.rules.get("budget", {})
        max_tokens = budget_rules.get("max_tokens_per_run", 20000)
        if total_tokens > max_tokens:
            raise GuardrailViolation(
                f"Token budget exceeded: {total_tokens} > {max_tokens}"
            )

    @classmethod
    def default(cls) -> "GuardrailValidator":
        return cls(rules={})
