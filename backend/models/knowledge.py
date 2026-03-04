from sqlalchemy import Column, String, Text, Integer, TIMESTAMP, CheckConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
import uuid
import os

from backend.models.base import Base

EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "2048"))


class KnowledgeSpace(Base):
    __tablename__ = "knowledge_spaces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(128), nullable=False)
    description = Column(Text)
    visibility = Column(String(16), default="private", nullable=False)
    retrieval_config = Column(
        JSONB,
        default={"top_k": 5, "similarity_threshold": 0.7, "mode": "hybrid"},
    )
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(
            "visibility IN ('private','team','public')",
            name="knowledge_spaces_visibility_check",
        ),
    )


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    space_id = Column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_spaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    title = Column(String(256))
    source_type = Column(String(32))
    source_ref = Column(Text)
    content = Column(Text)
    chunk_count = Column(Integer, default=0)
    status = Column(String(32), default="pending")
    error_message = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "source_type IN ('upload','lark_doc','lark_wiki','manual')",
            name="knowledge_documents_source_type_check",
        ),
        CheckConstraint(
            "status IN ('pending','indexing','ready','failed')",
            name="knowledge_documents_status_check",
        ),
    )


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    space_id = Column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_spaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    content = Column(Text, nullable=False)
    embedding = Column(Vector(EMBEDDING_DIM))
    chunk_index = Column(Integer)
    metadata_ = Column("metadata", JSONB, default={})
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
