from pydantic import BaseModel
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime


class KnowledgeSpaceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    visibility: str = "private"
    retrieval_config: Dict[str, Any] = {"top_k": 5, "similarity_threshold": 0.7, "mode": "hybrid"}


class KnowledgeSpaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[str] = None
    retrieval_config: Optional[Dict[str, Any]] = None


class KnowledgeSpaceRead(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    description: Optional[str] = None
    visibility: str
    retrieval_config: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class KnowledgeDocumentRead(BaseModel):
    id: UUID
    space_id: UUID
    title: Optional[str] = None
    source_type: Optional[str] = None
    source_ref: Optional[str] = None
    chunk_count: int
    status: str
    error_message: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class KnowledgeQueryRequest(BaseModel):
    query: str
    top_k: int = 5


class KnowledgeQueryResponse(BaseModel):
    results: list[Dict[str, Any]]
