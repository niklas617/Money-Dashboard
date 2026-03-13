from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from datetime import date
from pydantic import BaseModel

# Passe diese Imports an deine Ordnerstruktur an:
from backend.app.db.database import engine
from backend.app.db.models import Transaction, TransactionCreate, User
from backend.app.api.auth import get_current_user

# WICHTIG: In einer Unter-Datei nutzen wir APIRouter, nicht FastAPI!
router = APIRouter()


# --- Hilfsfunktion für die Datenbank-Session ---
def get_session():
    with Session(engine) as session:
        yield session


# --- Schema für Updates (Model) ---
class TransactionUpdate(BaseModel):
    amount: float
    note: str
    category_id: int
    account_id: int
    date: date


# ==========================================
# ROUTEN
# ==========================================


@router.post("/", response_model=Transaction)
def create_transaction(
    tx: TransactionCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    new_tx = Transaction.from_orm(tx)
    new_tx.user_id = current_user.id
    session.add(new_tx)
    session.commit()
    session.refresh(new_tx)
    return new_tx


@router.get("/filter", response_model=List[Transaction])
def filter_transactions(
    account_id: int,
    year: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # Zeige nur Buchungen für mein Konto UND meinen User
    statement = select(Transaction).where(
        Transaction.account_id == account_id, Transaction.user_id == current_user.id
    )
    return session.exec(statement).all()


@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # 1. Die Transaktion suchen
    statement = select(Transaction).where(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id,
    )
    tx = session.exec(statement).first()

    # 2. Prüfen
    if not tx:
        raise HTTPException(status_code=404, detail="Transaktion nicht gefunden")

    # 3. Löschen
    session.delete(tx)
    session.commit()

    return {"status": "ok", "message": "Gelöscht"}


# --- DER PUT ENDPUNKT (Bearbeiten) ---
@router.put("/{transaction_id}", response_model=Transaction)
def update_transaction(
    transaction_id: int,
    transaction_data: TransactionUpdate,
    session: Session = Depends(
        get_session
    ),  # <--- Hier nutzen wir jetzt korrekt get_session!
    current_user: User = Depends(get_current_user),
):
    # 1. Suchen (SQLModel Style)
    statement = select(Transaction).where(Transaction.id == transaction_id)
    db_tx = session.exec(statement).first()

    if not db_tx:
        raise HTTPException(status_code=404, detail="Buchung nicht gefunden")

    # Sicherheit: Gehört die Buchung mir?
    if db_tx.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Nicht erlaubt (Falscher User)")

    # 2. Werte aktualisieren
    db_tx.amount = transaction_data.amount
    db_tx.note = transaction_data.note
    db_tx.category_id = transaction_data.category_id
    db_tx.account_id = transaction_data.account_id
    db_tx.date = transaction_data.date

    # 3. Speichern
    session.add(db_tx)
    session.commit()
    session.refresh(db_tx)

    return db_tx
