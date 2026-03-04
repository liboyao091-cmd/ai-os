from sqlalchemy import Column, String, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from backend.models.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bytedance_uid = Column(String(64), unique=True, nullable=False)
    name = Column(String(128))
    team = Column(String(128))
    avatar_url = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
