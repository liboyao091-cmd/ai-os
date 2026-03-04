import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.deps import get_db, get_current_user
from backend.models.model_policy import ModelPolicy
from backend.models.user import User
from backend.schemas.model_policy import ModelPolicyCreate, ModelPolicyUpdate, ModelPolicyRead

router = APIRouter(prefix="/model-policies", tags=["model-policies"])


@router.get("", response_model=List[ModelPolicyRead])
def list_policies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(ModelPolicy)
        .filter(
            (ModelPolicy.owner_id == current_user.id)
            | (ModelPolicy.visibility.in_(["team", "public"]))
        )
        .all()
    )


@router.post("", response_model=ModelPolicyRead, status_code=201)
def create_policy(
    body: ModelPolicyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    policy = ModelPolicy(id=uuid.uuid4(), owner_id=current_user.id, **body.model_dump())
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy


@router.get("/{policy_id}", response_model=ModelPolicyRead)
def get_policy(policy_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = db.query(ModelPolicy).filter(ModelPolicy.id == policy_id).first()
    if not p:
        raise HTTPException(404, "Policy not found")
    return p


@router.put("/{policy_id}", response_model=ModelPolicyRead)
def update_policy(
    policy_id: uuid.UUID,
    body: ModelPolicyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = db.query(ModelPolicy).filter(ModelPolicy.id == policy_id).first()
    if not p:
        raise HTTPException(404, "Not found")
    if p.owner_id != current_user.id:
        raise HTTPException(403, "Forbidden")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{policy_id}", status_code=204)
def delete_policy(policy_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = db.query(ModelPolicy).filter(ModelPolicy.id == policy_id).first()
    if not p:
        raise HTTPException(404, "Not found")
    if p.owner_id != current_user.id:
        raise HTTPException(403, "Forbidden")
    db.delete(p)
    db.commit()


@router.post("/{policy_id}/fork", response_model=ModelPolicyRead, status_code=201)
def fork_policy(policy_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    original = db.query(ModelPolicy).filter(ModelPolicy.id == policy_id).first()
    if not original:
        raise HTTPException(404, "Not found")
    forked = ModelPolicy(
        id=uuid.uuid4(),
        owner_id=current_user.id,
        name=f"{original.name} (fork)",
        visibility="private",
        default_model=original.default_model,
        routing_rules=list(original.routing_rules or []),
        fallback_chain=list(original.fallback_chain or []),
        monthly_token_budget=original.monthly_token_budget,
        params_override=dict(original.params_override or {}),
    )
    db.add(forked)
    db.commit()
    db.refresh(forked)
    return forked
