"""RAG retriever — cosine similarity search over knowledge_chunks."""
from __future__ import annotations

from typing import Any, Dict, List, Optional


class RAGRetriever:
    def __init__(self, db=None, llm_gateway=None):
        self.db = db
        self.llm_gateway = llm_gateway

    def retrieve(
        self,
        query: str,
        space_ids: List[str],
        top_k: int = 5,
    ) -> str:
        """Return formatted context string from relevant chunks."""
        if not self.db or not self.llm_gateway or not space_ids:
            return ""

        try:
            from backend.models.knowledge import KnowledgeChunk
            import uuid

            embedding = self.llm_gateway.embed(query)

            chunks = (
                self.db.query(KnowledgeChunk)
                .filter(KnowledgeChunk.space_id.in_([uuid.UUID(sid) for sid in space_ids]))
                .order_by(KnowledgeChunk.embedding.cosine_distance(embedding))
                .limit(top_k)
                .all()
            )
            if not chunks:
                return ""
            return "\n\n---\n\n".join(c.content for c in chunks)
        except Exception:
            return ""
