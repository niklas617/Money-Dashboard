from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel
from backend.app.db.database import engine
from backend.app.db.models import Account, AccountCreate, User, Transaction
from backend.app.api.auth import get_current_user # <--- DAS IST NEU!

router = APIRouter()

def get_session():
    with Session(engine) as session:
        yield session


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    currency: Optional[str] = None
    opening_balance: Optional[float] = None

@router.post("/", response_model=Account)
def create_account(account: AccountCreate, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    # Wir nehmen die Daten vom Frontend...
    new_account = Account.from_orm(account)
    # ...und stempeln deinen Namen drauf!
    new_account.user_id = current_user.id 
    session.add(new_account)
    session.commit()
    session.refresh(new_account)
    return new_account

@router.get("/", response_model=List[Account])
def read_accounts(session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    # Zeige NUR Konten, die MIR gehören
    statement = select(Account).where(Account.user_id == current_user.id)
    return session.exec(statement).all()


@router.put("/{account_id}", response_model=Account)
def update_account(
    account_id: int,
    data: AccountUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    account = session.exec(
        select(Account).where(Account.id == account_id, Account.user_id == current_user.id)
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Konto nicht gefunden")

    if data.name is not None:
        account.name = data.name
    if data.currency is not None:
        account.currency = data.currency
    if data.opening_balance is not None:
        account.opening_balance = data.opening_balance

    session.add(account)
    session.commit()
    session.refresh(account)
    return account


@router.delete("/{account_id}")
def delete_account(
    account_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    account = session.exec(
        select(Account).where(Account.id == account_id, Account.user_id == current_user.id)
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Konto nicht gefunden")

    # Zugehörige Buchungen zuerst löschen – SQLite erzwingt FK-Cascades nicht
    # zuverlässig, deshalb machen wir es hier explizit (funktioniert auf SQLite & Postgres).
    related_tx = session.exec(
        select(Transaction).where(
            Transaction.account_id == account_id,
            Transaction.user_id == current_user.id,
        )
    ).all()
    for tx in related_tx:
        session.delete(tx)

    session.delete(account)
    session.commit()
    return {"status": "ok", "message": "Konto und zugehörige Buchungen gelöscht"}