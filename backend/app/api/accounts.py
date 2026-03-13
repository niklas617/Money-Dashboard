from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from typing import List
from backend.app.db.database import engine
from backend.app.db.models import Account, AccountCreate, User
from backend.app.api.auth import get_current_user # <--- DAS IST NEU!

router = APIRouter()

def get_session():
    with Session(engine) as session:
        yield session

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