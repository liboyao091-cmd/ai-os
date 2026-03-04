from sqlalchemy import Column, String, Text, Boolean, Integer, TIMESTAMP, CheckConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from backend.models.base import Base


class ExecutionRun(Base):
    __tablename__ = "execution_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    executor_id = Column(UUID(as_uuid=True), ForeignKey("executors.id"), nullable=True)
    orchestrator_id = Column(
        UUID(as_uuid=True), ForeignKey("orchestrators.id"), nullable=True
    )
    triggered_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    is_sandbox = Column(Boolean, default=False)
    input = Column(JSONB, default={})
    output = Column(JSONB)
    status = Column(String(32), default="running")
    steps_log = Column(JSONB, default=[])
    # Stores the paused state for human_confirm resumption
    paused_state = Column(JSONB, nullable=True)
    paused_step_id = Column(String(128), nullable=True)
    total_tokens = Column(Integer, default=0)
    duration_ms = Column(Integer)
    error_message = Column(Text)
    human_scores = Column(JSONB, default={})
    started_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    finished_at = Column(TIMESTAMP(timezone=True))

    __table_args__ = (
        CheckConstraint(
            "status IN ('running','waiting_confirm','success','failed','cancelled')",
            name="execution_runs_status_check",
        ),
    )
