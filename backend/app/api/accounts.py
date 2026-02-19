from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from backend.app.db.models import Account, AccountCreate
from backend.app.db.session import get_session

from sqlalchemy import func, case
from backend.app.db.models import Transaction

from sqlalchemy import func, case
from sqlmodel import select
from backend.app.db.models import Transaction





router = APIRouter(tags=["accounts"])

@router.post("/", response_model=Account)
def create_account(payload: AccountCreate, session: Session = Depends(get_session)):
    acc = Account(name=payload.name, currency=payload.currency)
    session.add(acc)
    session.commit()
    session.refresh(acc)
    return acc

@router.get("/", response_model=list[Account])
def list_accounts(session: Session = Depends(get_session)):
    return session.exec(select(Account)).all()

@router.get("/{account_id}/balance")
def get_account_balance(account_id: int, session: Session = Depends(get_session)):
    total = session.exec(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.account_id == account_id)
    ).one()
    return {"account_id": account_id, "balance": float(total)}

@router.get("/balances")
def get_all_balances(session: Session = Depends(get_session)):
    rows = session.exec(
        select(
            Account.id,
            Account.name,
            Account.currency,
            func.coalesce(func.sum(Transaction.amount), 0).label("balance"),
        )
        .join(Transaction, Transaction.account_id == Account.id, isouter=True)
        .group_by(Account.id)
    ).all()

    return [
        {
            "account_id": r.id,
            "account": r.name,
            "currency": r.currency,
            "balance": float(r.balance),
        }
        for r in rows
    ]

@router.get("/{account_id}/timeseries")
def account_timeseries(account_id: int, session: Session = Depends(get_session)):
    rows = session.exec(
        select(
            func.date(Transaction.created_at).label("day"),
            func.sum(Transaction.amount).label("delta"),
        )
        .where(Transaction.account_id == account_id)
        .group_by(func.date(Transaction.created_at))
        .order_by(func.date(Transaction.created_at))
    ).all()

    # kumulativer Saldo
    balance = 0.0
    series = []
    for r in rows:
        balance += float(r.delta)
        series.append({"day": str(r.day), "balance": round(balance, 2)})

    return series

@router.get("/{account_id}/income-expense")
def income_expense(account_id: int, session: Session = Depends(get_session)):
    rows = session.exec(
        select(
            func.sum(case((Transaction.amount > 0, Transaction.amount), else_=0)).label("income"),
            func.sum(case((Transaction.amount < 0, Transaction.amount), else_=0)).label("expense"),
        ).where(Transaction.account_id == account_id)
    ).one()

    return {
        "income": round(float(rows.income or 0), 2),
        "expense": round(abs(float(rows.expense or 0)), 2),
    }

    return {
        "income": round(float(rows.income or 0), 2),
        "expense": round(abs(float(rows.expense or 0)), 2),
    }

#--------------------------------------------------------------------------------------------------------
