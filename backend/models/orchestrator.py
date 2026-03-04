from sqlalchemy import Column, String, Text, TIMESTAMP, ARRAY, CheckConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from backend.models.base import Base


class Orchestrator(Base):
    __tablename__ = "orchestrators"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(128), nullable=False)
    description = Column(Text)
    tags = Column(ARRAY(Text), default=[])
    visibility = Column(String(16), default="private", nullable=False)
    fork_policy = Column(String(16), default="forkable", nullable=False)
    forked_from = Column(UUID(as_uuid=True), ForeignKey("orchestrators.id"), nullable=True)
    routing_type = Column(String(32), nullable=False)
    definition = Column(JSONB, nullable=False)
    executor_refs = Column(ARRAY(UUID(as_uuid=True)), default=[])
    model_policy_id = Column(
        UUID(as_uuid=True), ForeignKey("model_policies.id"), nullable=True
    )
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(
            "visibility IN ('private','team','public')",
            name="orchestrators_visibility_check",
        ),
        CheckConstraint(
            "fork_policy IN ('forkable','readonly')",
            name="orchestrators_fork_policy_check",
        ),
        CheckConstraint(
            "routing_type IN ('rule_based','intent_based','canvas','auto')",
            name="orchestrators_routing_type_check",
        ),
    )
