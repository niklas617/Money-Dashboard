from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from backend.app.db.models import Transaction, TransactionCreate
from backend.app.db.session import get_session

from datetime import datetime
from fastapi import Query

router = APIRouter(tags=["transactions"])


@router.post("/", response_model=Transaction)
def create_tx(payload: TransactionCreate, session: Session = Depends(get_session)):
    tx = Transaction(**payload.model_dump())
    session.add(tx)
    session.commit()
    session.refresh(tx)
    return tx


@router.get("/", response_model=list[Transaction])
def list_txs(session: Session = Depends(get_session)):
    return session.exec(select(Transaction)).all()

from datetime import datetime
from fastapi import Query

@router.get("/filter")
def filter_transactions(
    account_id: int,
    year: int = Query(..., ge=2000),
    month: int = Query(None, ge=1, le=12),
    session: Session = Depends(get_session),
):
    start = datetime(year, month or 1, 1)
    if month:
        end = datetime(year, month + 1, 1) if month < 12 else datetime(year + 1, 1, 1)
    else:
        end = datetime(year + 1, 1, 1)

    rows = session.exec(
        select(Transaction)
        .where(Transaction.account_id == account_id)
        .where(Transaction.created_at >= start)
        .where(Transaction.created_at < end)
        .order_by(Transaction.created_at)
    ).all()

    return rows

from pydantic import BaseModel

# Ein kleines Hilfsmodell, um nur die veränderten Daten zu empfangen
class TransactionUpdate(BaseModel):
    amount: float
    note: str
    category_id: int | None = None

@router.delete("/{tx_id}")
def delete_transaction(tx_id: int, session: Session = Depends(get_session)):
    """Löscht eine Buchung anhand ihrer ID."""
    tx = session.get(Transaction, tx_id)
    if tx:
        session.delete(tx)
        session.commit()
    return {"status": "gelöscht"}

@router.put("/{tx_id}")
def update_transaction(tx_id: int, payload: TransactionUpdate, session: Session = Depends(get_session)):
    """Aktualisiert eine bestehende Buchung."""
    tx = session.get(Transaction, tx_id)
    if tx:
        tx.amount = payload.amount
        tx.note = payload.note
        tx.category_id = payload.category_id
        session.add(tx)
        session.commit()
        session.refresh(tx)
        return tx
    return {"error": "Nicht gefunden"}
