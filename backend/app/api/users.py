from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from backend.app.db.models import User, UserCreate
from backend.app.db.session import get_session

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/", response_model=User)
def create_user(payload: UserCreate, session: Session = Depends(get_session)):
    db_user = User(name=payload.name, email=payload.email)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


@router.get("/", response_model=list[User])
def list_users(session: Session = Depends(get_session)):
    return session.exec(select(User)).all()


@router.delete("/{user_id}")
def delete_user(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    session.delete(user)
    session.commit()
    return {"deleted": user_id}
