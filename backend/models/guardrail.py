from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from backend.models.base import Base


class GuardrailRuleset(Base):
    __tablename__ = "guardrail_rulesets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(128), nullable=False)
    visibility = Column(String(16), default="private", nullable=False)
    rules = Column(JSONB, nullable=False, default={})
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "visibility IN ('private','team','public')",
            name="guardrail_rulesets_visibility_check",
        ),
    )
