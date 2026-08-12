from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List

from backend.app.db.database import engine
from backend.app.db.models import Budget, BudgetSet, User
from backend.app.api.auth import get_current_user

router = APIRouter()


def get_session():
    with Session(engine) as session:
        yield session


@router.get("/", response_model=List[Budget])
def list_budgets(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return session.exec(select(Budget).where(Budget.user_id == current_user.id)).all()


@router.put("/{category_id}", response_model=Budget)
def set_budget(
    category_id: int,
    data: BudgetSet,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Setzt (oder aktualisiert) das Monatslimit einer Kategorie – ein Budget pro Kategorie."""
    if data.monthly_limit <= 0:
        raise HTTPException(status_code=422, detail="monthly_limit muss groesser als 0 sein.")

    budget = session.exec(
        select(Budget).where(
            Budget.category_id == category_id, Budget.user_id == current_user.id
        )
    ).first()

    if budget:
        budget.monthly_limit = data.monthly_limit
    else:
        budget = Budget(
            category_id=category_id,
            monthly_limit=data.monthly_limit,
            user_id=current_user.id,
        )

    session.add(budget)
    session.commit()
    session.refresh(budget)
    return budget


@router.delete("/{category_id}")
def delete_budget(
    category_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    budget = session.exec(
        select(Budget).where(
            Budget.category_id == category_id, Budget.user_id == current_user.id
        )
    ).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget nicht gefunden")
    session.delete(budget)
    session.commit()
    return {"status": "ok"}
