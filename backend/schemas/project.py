from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    local_path: Optional[str] = None
    tags: List[str] = []


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    local_path: Optional[str] = None
    tags: Optional[List[str]] = None


class ProjectRead(ProjectBase):
    id: UUID
    owner_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
