from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from typing import List
from backend.app.db.database import engine
from backend.app.db.models import Category, CategoryCreate, User
from backend.app.api.auth import get_current_user

router = APIRouter()

def get_session():
    with Session(engine) as session:
        yield session

@router.post("/", response_model=Category)
def create_category(category: CategoryCreate, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    new_category = Category.from_orm(category)
    new_category.user_id = current_user.id # Stempel drauf!
    session.add(new_category)
    session.commit()
    session.refresh(new_category)
    return new_category

@router.get("/", response_model=List[Category])
def read_categories(session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    statement = select(Category).where(Category.user_id == current_user.id)
    return session.exec(statement).all()