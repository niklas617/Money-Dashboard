from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from backend.app.db.models import Category
from backend.app.db.session import get_session

# Prefix weglassen, da es in der main.py definiert wird!
router = APIRouter(tags=["categories"])

@router.get("/")
def get_categories(session: Session = Depends(get_session)):
    # Gibt alle Kategorien zurück.
    return session.exec(select(Category)).all()

@router.post("/")
def create_category(category: Category, session: Session = Depends(get_session)):
    # Legt eine neue Kategorie in der Datenbank an.
    session.add(category)
    session.commit()
    session.refresh(category)
    return category