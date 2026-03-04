from sqlalchemy import Column, String, Text, Boolean, Integer, TIMESTAMP, ARRAY, CheckConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from backend.models.base import Base


class Tool(Base):
    __tablename__ = "tools"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(128), nullable=False)
    description = Column(Text)
    tags = Column(ARRAY(Text), default=[])
    visibility = Column(
        String(16),
        default="private",
        nullable=False,
    )
    fork_policy = Column(String(16), default="forkable", nullable=False)
    forked_from = Column(UUID(as_uuid=True), ForeignKey("tools.id"), nullable=True)
    invoke_type = Column(String(32), nullable=False)
    invoke_config = Column(JSONB, nullable=False)
    input_schema = Column(JSONB, nullable=False, default={"type": "object", "properties": {}})
    output_schema = Column(JSONB, nullable=False, default={"type": "object", "properties": {}})
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(
            "visibility IN ('private','team','public')",
            name="tools_visibility_check",
        ),
        CheckConstraint(
            "fork_policy IN ('forkable','readonly')",
            name="tools_fork_policy_check",
        ),
        CheckConstraint(
            "invoke_type IN ('python_func','http_api','mcp','lark_api')",
            name="tools_invoke_type_check",
        ),
    )
