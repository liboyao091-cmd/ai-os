from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session

from backend.db.session import SessionLocal
from backend.models.user import User


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    x_user_id: str = Header(..., alias="X-User-ID"),
    db: Session = Depends(get_db),
) -> User:
    """Resolve or auto-create user from bytedance_uid header."""
    user = db.query(User).filter(User.bytedance_uid == x_user_id).first()
    if not user:
        user = User(bytedance_uid=x_user_id, name=x_user_id)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def get_current_user_query(
    user_id: str = None,
    db: Session = Depends(get_db),
) -> User:
    """Resolve user from query param — used for SSE endpoints where headers can't be set."""
    if not user_id:
        raise HTTPException(401, "user_id query param required")
    user = db.query(User).filter(User.bytedance_uid == user_id).first()
    if not user:
        user = User(bytedance_uid=user_id, name=user_id)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user
