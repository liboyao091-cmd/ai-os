import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.deps import get_db, get_current_user
from backend.models.guardrail import GuardrailRuleset
from backend.models.user import User
from backend.schemas.guardrail import GuardrailCreate, GuardrailUpdate, GuardrailRead

router = APIRouter(prefix="/guardrails", tags=["guardrails"])


@router.get("", response_model=List[GuardrailRead])
def list_guardrails(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return (
        db.query(GuardrailRuleset)
        .filter(
            (GuardrailRuleset.owner_id == current_user.id)
            | (GuardrailRuleset.visibility.in_(["team", "public"]))
        )
        .all()
    )


@router.post("", response_model=GuardrailRead, status_code=201)
def create_guardrail(body: GuardrailCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    gr = GuardrailRuleset(id=uuid.uuid4(), owner_id=current_user.id, **body.model_dump())
    db.add(gr)
    db.commit()
    db.refresh(gr)
    return gr


@router.get("/{gr_id}", response_model=GuardrailRead)
def get_guardrail(gr_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    gr = db.query(GuardrailRuleset).filter(GuardrailRuleset.id == gr_id).first()
    if not gr:
        raise HTTPException(404, "Not found")
    return gr


@router.put("/{gr_id}", response_model=GuardrailRead)
def update_guardrail(gr_id: uuid.UUID, body: GuardrailUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    gr = db.query(GuardrailRuleset).filter(GuardrailRuleset.id == gr_id).first()
    if not gr:
        raise HTTPException(404, "Not found")
    if gr.owner_id != current_user.id:
        raise HTTPException(403, "Forbidden")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(gr, k, v)
    db.commit()
    db.refresh(gr)
    return gr


@router.delete("/{gr_id}", status_code=204)
def delete_guardrail(gr_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    gr = db.query(GuardrailRuleset).filter(GuardrailRuleset.id == gr_id).first()
    if not gr:
        raise HTTPException(404, "Not found")
    if gr.owner_id != current_user.id:
        raise HTTPException(403, "Forbidden")
    db.delete(gr)
    db.commit()


@router.post("/{gr_id}/fork", response_model=GuardrailRead, status_code=201)
def fork_guardrail(gr_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    original = db.query(GuardrailRuleset).filter(GuardrailRuleset.id == gr_id).first()
    if not original:
        raise HTTPException(404, "Not found")
    forked = GuardrailRuleset(
        id=uuid.uuid4(),
        owner_id=current_user.id,
        name=f"{original.name} (fork)",
        visibility="private",
        rules=dict(original.rules or {}),
    )
    db.add(forked)
    db.commit()
    db.refresh(forked)
    return forked
