"""Unified LLM call gateway — OpenAI-compatible, supports model routing + fallback."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import requests


@dataclass
class LLMResponse:
    text: Optional[str]
    finish_reason: str
    tokens: int
    tool_call: Optional["ToolCall"] = None
    raw_content: Any = None


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: Dict[str, Any]


class LLMGateway:
    """
    Sends chat completions to the internal Doubao/OpenAI-compatible endpoint.
    Supports model routing rules and fallback chain from a ModelPolicy dict.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        token: Optional[str] = None,
        model_policy: Optional[Dict[str, Any]] = None,
    ):
        self.base_url = (base_url or os.getenv("LLM_GATEWAY_BASE_URL", "")).rstrip("/")
        self.token = token or os.getenv("LLM_GATEWAY_TOKEN", "")
        self.policy = model_policy or {}

    def complete(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        task_type: Optional[str] = None,
    ) -> LLMResponse:
        model = self._route_model(task_type)
        fallback_chain = [model] + list(self.policy.get("fallback_chain", []))

        for attempt, m in enumerate(fallback_chain):
            try:
                return self._call(m, messages, tools)
            except Exception as exc:
                if attempt == len(fallback_chain) - 1:
                    raise
                continue

        raise RuntimeError("All LLM fallback models failed")

    def _call(
        self,
        model: str,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]],
    ) -> LLMResponse:
        params: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "max_tokens": 4096,
        }
        params.update(self.policy.get("params_override", {}))
        if tools:
            params["tools"] = tools

        resp = requests.post(
            f"{self.base_url}/chat/completions",
            json=params,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
            },
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()

        choice = data["choices"][0]
        message = choice["message"]
        finish_reason = choice.get("finish_reason", "stop")
        tokens = data.get("usage", {}).get("total_tokens", 0)
        text = message.get("content")

        tool_call = self._parse_tool_call(message)

        return LLMResponse(
            text=text,
            finish_reason=finish_reason,
            tokens=tokens,
            tool_call=tool_call,
            raw_content=message,
        )

    def _parse_tool_call(self, message: Dict[str, Any]) -> Optional[ToolCall]:
        tool_calls = message.get("tool_calls")
        if not tool_calls:
            return None
        tc = tool_calls[0]
        import json

        args = tc["function"].get("arguments", "{}")
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except Exception:
                args = {}
        return ToolCall(
            id=tc.get("id", ""),
            name=tc["function"]["name"],
            arguments=args,
        )

    def _route_model(self, task_type: Optional[str]) -> str:
        default = self.policy.get(
            "default_model", os.getenv("LLM_DEFAULT_MODEL", "doubao-pro-32k-241215")
        )
        for rule in self.policy.get("routing_rules", []):
            condition = rule.get("condition", "False")
            try:
                if eval(condition, {"task_type": task_type}):  # noqa: S307
                    return rule["model"]
            except Exception:
                pass
        return default

    def embed(self, text: str) -> List[float]:
        """Generate embedding vector for RAG indexing."""
        model = os.getenv("LLM_EMBEDDING_MODEL", "doubao-embedding-large-text-240915")
        resp = requests.post(
            f"{self.base_url}/embeddings",
            json={"model": model, "input": text},
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["data"][0]["embedding"]
