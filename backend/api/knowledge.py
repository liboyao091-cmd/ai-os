import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from backend.api.deps import get_db, get_current_user
from backend.models.knowledge import KnowledgeSpace, KnowledgeDocument
from backend.models.user import User
from backend.schemas.knowledge import (
    KnowledgeSpaceCreate, KnowledgeSpaceUpdate, KnowledgeSpaceRead,
    KnowledgeDocumentRead, KnowledgeQueryRequest, KnowledgeQueryResponse,
)

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


@router.get("/spaces", response_model=List[KnowledgeSpaceRead])
def list_spaces(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(KnowledgeSpace)
        .filter(
            (KnowledgeSpace.owner_id == current_user.id)
            | (KnowledgeSpace.visibility.in_(["team", "public"]))
        )
        .order_by(KnowledgeSpace.updated_at.desc())
        .all()
    )


@router.post("/spaces", response_model=KnowledgeSpaceRead, status_code=201)
def create_space(
    body: KnowledgeSpaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    space = KnowledgeSpace(id=uuid.uuid4(), owner_id=current_user.id, **body.model_dump())
    db.add(space)
    db.commit()
    db.refresh(space)
    return space


@router.get("/spaces/{space_id}", response_model=KnowledgeSpaceRead)
def get_space(
    space_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    space = db.query(KnowledgeSpace).filter(KnowledgeSpace.id == space_id).first()
    if not space:
        raise HTTPException(404, "Space not found")
    return space


@router.put("/spaces/{space_id}", response_model=KnowledgeSpaceRead)
def update_space(
    space_id: uuid.UUID,
    body: KnowledgeSpaceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    space = db.query(KnowledgeSpace).filter(KnowledgeSpace.id == space_id).first()
    if not space:
        raise HTTPException(404, "Space not found")
    if space.owner_id != current_user.id:
        raise HTTPException(403, "Not your space")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(space, k, v)
    db.commit()
    db.refresh(space)
    return space


@router.delete("/spaces/{space_id}", status_code=204)
def delete_space(
    space_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    space = db.query(KnowledgeSpace).filter(KnowledgeSpace.id == space_id).first()
    if not space:
        raise HTTPException(404, "Space not found")
    if space.owner_id != current_user.id:
        raise HTTPException(403, "Not your space")
    db.delete(space)
    db.commit()


@router.post("/spaces/{space_id}/documents", response_model=KnowledgeDocumentRead, status_code=201)
async def upload_document(
    space_id: uuid.UUID,
    title: Optional[str] = Form(None),
    source_type: str = Form("upload"),
    file: Optional[UploadFile] = File(None),
    content: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    space = db.query(KnowledgeSpace).filter(KnowledgeSpace.id == space_id).first()
    if not space:
        raise HTTPException(404, "Space not found")

    text_content = content
    if file and not text_content:
        raw = await file.read()
        text_content = raw.decode("utf-8", errors="replace")

    doc = KnowledgeDocument(
        id=uuid.uuid4(),
        space_id=space_id,
        title=title or (file.filename if file else "Untitled"),
        source_type=source_type,
        content=text_content,
        status="pending",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Trigger async indexing
    try:
        from backend.tasks.index_document import index_document_task
        index_document_task.delay(str(doc.id))
    except Exception:
        pass  # Celery may not be running in dev

    return doc


@router.get("/spaces/{space_id}/documents", response_model=List[KnowledgeDocumentRead])
def list_documents(
    space_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(KnowledgeDocument)
        .filter(KnowledgeDocument.space_id == space_id)
        .order_by(KnowledgeDocument.created_at.desc())
        .all()
    )


@router.delete("/documents/{doc_id}", status_code=204)
def delete_document(
    doc_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    db.delete(doc)
    db.commit()


@router.post("/spaces/{space_id}/query", response_model=KnowledgeQueryResponse)
def query_space(
    space_id: uuid.UUID,
    body: KnowledgeQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from backend.core.rag.retriever import RAGRetriever
    from backend.core.llm.gateway import LLMGateway

    llm = LLMGateway()
    rag = RAGRetriever(db=db, llm_gateway=llm)
    text = rag.retrieve(body.query, [str(space_id)], top_k=body.top_k)
    results = [{"content": chunk} for chunk in text.split("\n\n---\n\n") if chunk] if text else []
    return KnowledgeQueryResponse(results=results)
