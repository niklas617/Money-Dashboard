from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select
from sqlalchemy import func

from backend.app.db.session import get_session
from backend.app.db.models import Transaction, Category

router = APIRouter(tags=["reports"])


@router.get("/monthly")
def monthly_report(
    account_id: int = Query(..., ge=1),
    year: int = Query(..., ge=2000),
    month: int = Query(..., ge=1, le=12),
    session: Session = Depends(get_session),
):
    # Zeitraum [start, end)
    start = datetime(year, month, 1)
    end = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)

    # Totals (income/expense) im Zeitraum
    income = session.exec(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.account_id == account_id)
        .where(Transaction.created_at >= start)
        .where(Transaction.created_at < end)
        .where(Transaction.amount > 0)
    ).one()

    expense = session.exec(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.account_id == account_id)
        .where(Transaction.created_at >= start)
        .where(Transaction.created_at < end)
        .where(Transaction.amount < 0)
    ).one()

    # Monats-Balance-Delta = income + expense (expense ist negativ)
    net = float(income) + float(expense)

    # Kontostand bis Monatsende (kumuliert bis end)
    balance_end = session.exec(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.account_id == account_id)
        .where(Transaction.created_at < end)
    ).one()

    # Ausgaben nach Kategorie (positive Beträge für Darstellung)
    rows = session.exec(
        select(
            func.coalesce(Category.name, "(keine)").label("category"),
            func.coalesce(func.sum(-Transaction.amount), 0).label("spent"),
        )
        .select_from(Transaction)
        .join(Category, Category.id == Transaction.category_id, isouter=True)
        .where(Transaction.account_id == account_id)
        .where(Transaction.created_at >= start)
        .where(Transaction.created_at < end)
        .where(Transaction.amount < 0)
        .group_by(func.coalesce(Category.name, "(keine)"))
        .order_by(func.coalesce(func.sum(-Transaction.amount), 0).desc())
    ).all()

    by_category = [{"category": r.category, "spent": float(r.spent)} for r in rows]

    return {
        "account_id": account_id,
        "period": {"year": year, "month": month},
        "kpis": {
            "income": float(income),
            "expense": abs(float(expense)),  # als positive Zahl
            "net": net,
            "balance_end": float(balance_end),
        },
        "by_category": by_category,
    }

# --- NEU: Endpunkt für das Kreisdiagramm ---
@router.get("/chart-data")
def chart_data(
    account_id: int = Query(..., ge=1),
    tx_type: str = Query("expense"),  # NEU: Unterscheidet Einnahmen und Ausgaben
    session: Session = Depends(get_session)
):
    # """Liefert die aggregierten Daten für das Diagramm (Einnahmen oder Ausgaben)."""
    
    # Entscheiden, ob wir nach Plus- oder Minus-Beträgen suchen
    if tx_type == "expense":
        condition = Transaction.amount < 0
        amount_col = -Transaction.amount  # Minus mal Minus = Plus (fürs Diagramm)
    else:
        condition = Transaction.amount > 0
        amount_col = Transaction.amount
        
    rows = session.exec(
        select(
            func.coalesce(Category.name, "(keine)").label("category"),
            func.coalesce(func.sum(amount_col), 0).label("total"), 
        )
        .select_from(Transaction)
        .join(Category, Category.id == Transaction.category_id, isouter=True)
        .where(Transaction.account_id == account_id)
        .where(condition)  # Hier wenden wir den Filter an
        .group_by(func.coalesce(Category.name, "(keine)"))
        .order_by(func.coalesce(func.sum(amount_col), 0).desc())
    ).all()

    return [{"category": r.category, "total": float(r.total)} for r in rows]