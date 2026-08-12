from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List

from backend.app.db.database import engine
from backend.app.db.models import PriceAlert, PriceAlertCreate, User
from backend.app.api.auth import get_current_user

router = APIRouter()


def get_session():
    with Session(engine) as session:
        yield session


# Routen ohne abschliessenden Slash -> passt exakt zu Web-App und Flutter (/alerts)

@router.get("", response_model=List[PriceAlert])
def list_alerts(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return session.exec(select(PriceAlert).where(PriceAlert.user_id == current_user.id)).all()


@router.post("", response_model=PriceAlert)
def create_alert(
    data: PriceAlertCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if data.target_price <= 0:
        raise HTTPException(status_code=422, detail="target_price muss groesser als 0 sein.")

    alert = PriceAlert(
        symbol=(data.symbol or "").upper().strip(),
        asset_type=(data.asset_type or "crypto").lower().strip(),
        target_price=data.target_price,
        above=data.above,
        user_id=current_user.id,
    )
    session.add(alert)
    session.commit()
    session.refresh(alert)
    return alert


@router.delete("/{alert_id}")
def delete_alert(
    alert_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    alert = session.exec(
        select(PriceAlert).where(PriceAlert.id == alert_id, PriceAlert.user_id == current_user.id)
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert nicht gefunden")
    session.delete(alert)
    session.commit()
    return {"status": "ok"}
