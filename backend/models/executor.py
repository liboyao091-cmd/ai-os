from sqlalchemy import Column, String, Text, Boolean, Integer, TIMESTAMP, ARRAY, CheckConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from backend.models.base import Base


class Executor(Base):
    __tablename__ = "executors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(128), nullable=False)
    description = Column(Text)
    tags = Column(ARRAY(Text), default=[])
    visibility = Column(String(16), default="private", nullable=False)
    fork_policy = Column(String(16), default="forkable", nullable=False)
    forked_from = Column(UUID(as_uuid=True), ForeignKey("executors.id"), nullable=True)
    executor_type = Column(String(32), nullable=False)
    definition = Column(JSONB, nullable=False)
    tool_ids = Column(ARRAY(UUID(as_uuid=True)), default=[])
    knowledge_ids = Column(ARRAY(UUID(as_uuid=True)), default=[])
    model_policy_id = Column(
        UUID(as_uuid=True), ForeignKey("model_policies.id"), nullable=True
    )
    guardrail_id = Column(
        UUID(as_uuid=True), ForeignKey("guardrail_rulesets.id"), nullable=True
    )
    input_schema = Column(JSONB, default={"type": "object", "properties": {}})
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(
            "visibility IN ('private','team','public')",
            name="executors_visibility_check",
        ),
        CheckConstraint(
            "fork_policy IN ('forkable','readonly')",
            name="executors_fork_policy_check",
        ),
        CheckConstraint(
            "executor_type IN ('workflow','ai_workflow','agent','multi_agent','copilot')",
            name="executors_type_check",
        ),
    )
