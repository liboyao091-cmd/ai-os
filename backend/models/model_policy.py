from sqlalchemy import Column, String, Integer, TIMESTAMP, ARRAY, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from backend.models.base import Base


class ModelPolicy(Base):
    __tablename__ = "model_policies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(128), nullable=False)
    visibility = Column(String(16), default="private", nullable=False)
    default_model = Column(String(64), default="doubao-pro")
    routing_rules = Column(JSONB, default=[])
    fallback_chain = Column(ARRAY(String), default=["doubao-pro"])
    monthly_token_budget = Column(Integer, default=1000000)
    params_override = Column(JSONB, default={})
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "visibility IN ('private','team','public')",
            name="model_policies_visibility_check",
        ),
    )
