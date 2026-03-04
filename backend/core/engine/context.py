"""RunContext — assembled by the API layer before starting any execution."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from backend.core.tools.invoker import ToolInvoker
from backend.core.llm.gateway import LLMGateway
from backend.core.rag.retriever import RAGRetriever
from backend.core.guardrails.validator import GuardrailValidator


@dataclass
class RunContext:
    run_id: str
    user_id: str
    tools: Dict[str, ToolInvoker] = field(default_factory=dict)
    knowledge_space_ids: List[str] = field(default_factory=list)
    llm_gateway: Optional[LLMGateway] = None
    rag: Optional[RAGRetriever] = None
    guardrails: Optional[GuardrailValidator] = None
    is_sandbox: bool = False

    def __post_init__(self):
        if self.guardrails is None:
            self.guardrails = GuardrailValidator.default()
        if self.llm_gateway is None:
            self.llm_gateway = LLMGateway()
        if self.rag is None:
            self.rag = RAGRetriever()
