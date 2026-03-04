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
