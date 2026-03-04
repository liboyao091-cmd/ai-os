"""Document chunker and indexer for knowledge spaces."""
from __future__ import annotations

import re
import uuid
from typing import List


def chunk_text(text: str, size: int = 512, overlap: int = 64) -> List[str]:
    """Split text into overlapping chunks by character count."""
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = start + size
        chunks.append(text[start:end])
        start += size - overlap
    return chunks


def index_document(document_id: str, db) -> None:
    """Chunk and embed a document, storing vectors in knowledge_chunks."""
    from backend.models.knowledge import KnowledgeDocument, KnowledgeChunk
    from backend.core.llm.gateway import LLMGateway

    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == uuid.UUID(document_id)).first()
    if not doc:
        raise ValueError(f"Document {document_id} not found")

    doc.status = "indexing"
    db.commit()

    try:
        llm = LLMGateway()
        text = doc.content or ""
        chunks = chunk_text(text)

        # Delete old chunks
        db.query(KnowledgeChunk).filter(KnowledgeChunk.document_id == doc.id).delete()

        for idx, chunk_content in enumerate(chunks):
            embedding = llm.embed(chunk_content)
            chunk = KnowledgeChunk(
                id=uuid.uuid4(),
                document_id=doc.id,
                space_id=doc.space_id,
                content=chunk_content,
                embedding=embedding,
                chunk_index=idx,
            )
            db.add(chunk)

        doc.chunk_count = len(chunks)
        doc.status = "ready"
        db.commit()
    except Exception as exc:
        doc.status = "failed"
        doc.error_message = str(exc)
        db.commit()
        raise
