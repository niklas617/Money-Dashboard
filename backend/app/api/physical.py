"""Physische Werte / Sachwerte (Edelmetalle etc.).

Zentrale Stelle fuer ALLE Berechnungen rund um physische Vermoegenswerte –
Web-App und Flutter-App rufen nur diese Endpoints auf und rendern die Ergebnisse.
Keine doppelte Rechenlogik pro Plattform.

Kurse laufen ueber DIESELBE Infrastruktur wie Aktien (yfinance + EUR/USD-Helfer
aus portfolio.py). Zielwaehrung ist immer EUR; intern rechnen wir in EUR pro Gramm.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

import yfinance as yf
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from backend.app.api.auth import get_current_user
from backend.app.api.portfolio import _get_eurusd_rate, _fetch_eurusd_history, _to_date
from backend.app.db.database import engine
from backend.app.db.models import (
    PhysicalAsset,
    PhysicalAssetCreate,
    PhysicalAssetUpdate,
    User,
)

router = APIRouter()


def get_session():
    with Session(engine) as session:
        yield session


# ==========================================
# METALL-KONFIGURATION & EINHEITEN
# ==========================================

GRAMS_PER_TROY_OUNCE = 31.1034768   # 1 Feinunze
GRAMS_PER_POUND = 453.59237         # 1 lb (fuer Kupfer-Notierung HG=F)

# Wie viele Gramm eine erfasste Menge-Einheit hat.
UNIT_TO_GRAMS: Dict[str, float] = {
    "g": 1.0,
    "kg": 1000.0,
    "oz": GRAMS_PER_TROY_OUNCE,   # Feinunze
}
VALID_UNITS = set(UNIT_TO_GRAMS.keys())

# Unterstuetzte Metalle: yfinance-Ticker + wie viele Gramm die Kurs-Notierung umfasst.
#  - Edelmetalle (GC=F/SI=F/PL=F/PA=F): USD je Feinunze.
#  - Kupfer (HG=F): USD je Pfund -> wird sauber auf EUR/Gramm umgerechnet.
METALS: Dict[str, dict] = {
    "XAU": {"name": "Gold",      "ticker": "GC=F", "quote_grams": GRAMS_PER_TROY_OUNCE, "default_unit": "g"},
    "XAG": {"name": "Silber",    "ticker": "SI=F", "quote_grams": GRAMS_PER_TROY_OUNCE, "default_unit": "g"},
    "XPT": {"name": "Platin",    "ticker": "PL=F", "quote_grams": GRAMS_PER_TROY_OUNCE, "default_unit": "g"},
    "XPD": {"name": "Palladium", "ticker": "PA=F", "quote_grams": GRAMS_PER_TROY_OUNCE, "default_unit": "g"},
    "XCU": {"name": "Kupfer",    "ticker": "HG=F", "quote_grams": GRAMS_PER_POUND,      "default_unit": "kg"},
}

# Zeitraum -> yfinance (period, interval). Deckt 1W / 1M / 6M / 1J / 5J / Max ab.
RANGE_PARAMS: Dict[str, tuple] = {
    "1W":  ("7d",  "1d"),
    "1M":  ("1mo", "1d"),
    "6M":  ("6mo", "1d"),
    "1J":  ("1y",  "1d"),
    "5J":  ("5y",  "1wk"),
    "MAX": ("max", "1mo"),
}


def _norm_range(r: Optional[str]) -> str:
    """Range-Eingabe robust normalisieren (akzeptiert 1y, all, … als Synonyme)."""
    if not r:
        return "1J"
    key = r.strip().upper()
    synonyms = {"1Y": "1J", "3M": "6M", "ALL": "MAX", "ALLE": "MAX", "MAXIMUM": "MAX"}
    key = synonyms.get(key, key)
    return key if key in RANGE_PARAMS else "1J"


def fine_grams_of(quantity: float, unit: str, fineness: float) -> float:
    """Feinmenge in Gramm = Menge (in Gramm) * Feingehalt/1000."""
    grams = quantity * UNIT_TO_GRAMS.get(unit, 1.0)
    return grams * (float(fineness) / 1000.0)


def gross_grams_of(quantity: float, unit: str) -> float:
    return quantity * UNIT_TO_GRAMS.get(unit, 1.0)


# ==========================================
# KURSE (EUR pro Gramm) – gleiche Quelle wie Aktien
# ==========================================

def _empty_price() -> dict:
    return {
        "price_per_gram": 0.0,
        "price_per_ounce": 0.0,
        "quote_time": None,       # echte Ermittlungszeit (UTC ISO) oder None
        "market_state": None,     # "REGULAR" / "CLOSED" / "PRE" / "POST"
        "is_live": False,         # True = Live-Kurs, False = Schlusskurs-Fallback
        "has_market_price": False,
    }


def _live_price_eur_per_gram(metal: str) -> dict:
    """Aktueller Kurs eines Metalls in EUR/Gramm.

    Liefert zusaetzlich EUR/Feinunze, die *tatsaechliche* Quote-Zeit der Boerse
    (regularMarketTime, nicht die Abrufzeit), den Marktstatus und ein `is_live`-
    Flag. Faellt der Live-Kurs aus, wird der letzte Schlusskurs mit dessen Datum
    genutzt (is_live=False) – statt Fehler, 0 € oder erfundenem Zeitstempel.
    """
    conf = METALS.get(metal)
    if not conf:
        return _empty_price()

    quote_grams = conf["quote_grams"]
    eurusd = _get_eurusd_rate()
    t = yf.Ticker(conf["ticker"])

    usd = 0.0
    quote_time: Optional[str] = None
    market_state: Optional[str] = None

    # 1) Quote-Zeit + Marktstatus (best effort ueber .info) und Preis
    try:
        info = t.info
        usd = float(info.get("regularMarketPrice") or 0.0)
        rmt = info.get("regularMarketTime")
        if isinstance(rmt, (int, float)) and rmt > 0:
            quote_time = datetime.fromtimestamp(rmt, tz=timezone.utc).isoformat()
        market_state = info.get("marketState")
    except Exception:
        pass

    # Preis notfalls ueber das schnelle fast_info nachziehen
    if usd <= 0:
        try:
            usd = float(getattr(t.fast_info, "last_price", None) or 0.0)
        except Exception:
            pass

    if usd > 0:
        ppg = (usd / eurusd) / quote_grams
        return {
            "price_per_gram": ppg,
            "price_per_ounce": ppg * GRAMS_PER_TROY_OUNCE,
            "quote_time": quote_time,
            "market_state": market_state,
            "is_live": True,
            "has_market_price": True,
        }

    # 2) Fallback: letzter bekannter Schlusskurs (klar als Schlusskurs markiert)
    try:
        hist = t.history(period="7d")
        if not hist.empty:
            ts = hist.index[-1]
            usd = float(hist["Close"].iloc[-1])
            if usd > 0:
                ppg = (usd / eurusd) / quote_grams
                return {
                    "price_per_gram": ppg,
                    "price_per_ounce": ppg * GRAMS_PER_TROY_OUNCE,
                    "quote_time": ts.to_pydatetime().astimezone(timezone.utc).isoformat(),
                    "market_state": "CLOSED",
                    "is_live": False,
                    "has_market_price": True,
                }
    except Exception:
        pass

    return _empty_price()


def fetch_metal_prices(metals: List[str]) -> Dict[str, dict]:
    """Kurse (EUR/Gramm etc.) fuer eine Liste bekannter Metalle."""
    return {m: _live_price_eur_per_gram(m) for m in set(metals) if m in METALS}


def fetch_metal_price_history(metals: List[str], start_date) -> Dict[str, Dict[str, float]]:
    """Historische Tages-Kurse (EUR/Gramm) je Metall ab start_date.

    USD/Notierungseinheit -> EUR/Gramm mit historischem EUR/USD (Forward-Fill).
    Nur bekannte Metalle (mit Ticker); Rest wird uebersprungen.
    """
    out: Dict[str, Dict[str, float]] = {}
    start_str = _to_date(start_date).strftime("%Y-%m-%d")
    end_str = datetime.utcnow().strftime("%Y-%m-%d")
    eurusd_hist = _fetch_eurusd_history(start_str, end_str)
    fallback = _get_eurusd_rate()

    for m in set(metals):
        conf = METALS.get(m)
        if not conf:
            continue
        try:
            hist = yf.Ticker(conf["ticker"]).history(start=start_str, end=end_str)
        except Exception:
            continue
        if hist.empty:
            continue
        qg = conf["quote_grams"]
        series: Dict[str, float] = {}
        last_rate = fallback
        for ts, usd in hist["Close"].items():
            ds = ts.strftime("%Y-%m-%d")
            r = eurusd_hist.get(ds)
            if r and r > 0:
                last_rate = r
            try:
                val = (float(usd) / last_rate) / qg
                if val > 0:
                    series[ds] = val
            except Exception:
                pass
        out[m] = series
    return out


def metal_value_history(assets: List[PhysicalAsset]) -> Dict[str, float]:
    """Tageswert (EUR) aller physischen Positionen – fuer die Gesamtvermoegens-Kurve.

    - Bekannte Metalle: Feinmenge (ab Kaufdatum gehalten) * historischer EUR/g-Kurs
      (Forward-Fill), analog zur Portfolio-Historie.
    - Freitext-Metalle ohne Marktkurs: mit dem Kaufpreis ab Kaufdatum bewertet.
    Rueckgabe: {YYYY-MM-DD: Gesamtwert}. Leeres Dict, wenn keine (datierten) Positionen.
    """
    import pandas as pd

    dated = [a for a in assets if a.purchase_date is not None]
    if not dated:
        return {}

    known = [a for a in dated if a.metal in METALS]
    custom = [a for a in dated if a.metal not in METALS]

    start = min(_to_date(a.purchase_date) for a in dated)
    today = datetime.utcnow().date()

    price_hist = fetch_metal_price_history([a.metal for a in known], start) if known else {}
    last_price: Dict[str, float] = {}
    result: Dict[str, float] = {}

    for dt in pd.date_range(start=start, end=today, freq="D"):
        d = dt.date()
        ds = d.strftime("%Y-%m-%d")
        val = 0.0

        held: Dict[str, float] = {}
        for a in known:
            if _to_date(a.purchase_date) <= d:
                held[a.metal] = held.get(a.metal, 0.0) + fine_grams_of(a.quantity, a.unit, a.fineness)
        for m, fg in held.items():
            p = price_hist.get(m, {}).get(ds)
            if p and p > 0:
                last_price[m] = p
            val += fg * last_price.get(m, 0.0)

        for a in custom:
            if _to_date(a.purchase_date) <= d:
                val += (a.purchase_price_eur or 0.0)

        result[ds] = val

    return result


# ==========================================
# ZENTRALE BERECHNUNG (Uebersicht + Detail)
# ==========================================

def compute_physical_summary(assets: List[PhysicalAsset], price_map: Dict[str, dict]) -> dict:
    """Aggregiert Positionen pro Metall und berechnet Werte, P&L und Anteile.

    - Mehrere Kaeufe desselben Metalls werden zu EINEM Uebersichts-Eintrag
      zusammengefasst, die Einzelpositionen aber mitgeliefert (fuer die Detailseite).
    - Wert = Feinmenge (g) * aktueller Kurs (EUR/g).
    - Ist fuer ein Metall kein Marktkurs verfuegbar (unbekanntes Freitext-Metall
      oder Kurs komplett ausgefallen), wird der Einstand als Wert genutzt (P&L 0),
      damit nie 0 € oder ein Fehler erscheint.
    """
    groups: Dict[str, dict] = {}

    for a in assets:
        g = groups.get(a.metal)
        if g is None:
            g = {
                "metal": a.metal,
                "name": a.name or METALS.get(a.metal, {}).get("name", a.metal),
                "asset_class": a.asset_class,
                "gross_grams": 0.0,
                "fine_grams": 0.0,
                "total_cost": 0.0,
                "positions": [],
                "earliest_date": None,
            }
            groups[a.metal] = g

        fg = fine_grams_of(a.quantity, a.unit, a.fineness)
        gg = gross_grams_of(a.quantity, a.unit)
        g["gross_grams"] += gg
        g["fine_grams"] += fg
        g["total_cost"] += (a.purchase_price_eur or 0.0)

        date_iso = a.purchase_date.isoformat() if a.purchase_date else None
        if date_iso and (g["earliest_date"] is None or date_iso < g["earliest_date"]):
            g["earliest_date"] = date_iso

        g["positions"].append({
            "id": a.id,
            "quantity": a.quantity,
            "unit": a.unit,
            "fineness": a.fineness,
            "fine_grams": fg,
            "gross_grams": gg,
            "purchase_price_eur": a.purchase_price_eur or 0.0,
            "price_per_unit_paid": ((a.purchase_price_eur or 0.0) / a.quantity) if a.quantity else 0.0,
            "cost_per_fine_gram": ((a.purchase_price_eur or 0.0) / fg) if fg > 1e-9 else 0.0,
            "purchase_date": date_iso,
            "storage_location": a.storage_location or None,
            "note": a.note or None,
        })

    metals_out: List[dict] = []
    total_value = 0.0
    total_cost = 0.0

    for metal, g in groups.items():
        fine = g["fine_grams"]
        cost = g["total_cost"]
        avg_cost_per_fine_gram = (cost / fine) if fine > 1e-9 else 0.0

        pinfo = price_map.get(metal) or {}
        ppg = float(pinfo.get("price_per_gram") or 0.0)

        if ppg > 0:
            price_per_gram = ppg
            price_per_ounce = float(pinfo.get("price_per_ounce") or (ppg * GRAMS_PER_TROY_OUNCE))
            price_time = pinfo.get("quote_time")
            price_is_live = bool(pinfo.get("is_live", False))
            price_market_state = pinfo.get("market_state")
            has_market_price = True
        else:
            # Kein Marktkurs -> Einstand als Wert (P&L 0), kein Zeitstempel.
            price_per_gram = avg_cost_per_fine_gram
            price_per_ounce = avg_cost_per_fine_gram * GRAMS_PER_TROY_OUNCE
            price_time = None
            price_is_live = False
            price_market_state = None
            has_market_price = False

        current_value = fine * price_per_gram
        pnl = current_value - cost
        pnl_pct = (pnl / cost * 100.0) if cost > 1e-9 else 0.0

        metals_out.append({
            "metal": metal,
            "name": g["name"],
            "asset_class": g["asset_class"],
            "gross_grams": gross_grams_round(g["gross_grams"]),
            "fine_grams": round(fine, 4),
            "total_cost": round(cost, 2),
            "current_value": round(current_value, 2),
            "unrealized_pnl": round(pnl, 2),
            "unrealized_pnl_pct": round(pnl_pct, 2),
            "price_per_gram": round(price_per_gram, 4),
            "price_per_ounce": round(price_per_ounce, 2),
            "price_time": price_time,
            "price_is_live": price_is_live,
            "price_market_state": price_market_state,
            "has_market_price": has_market_price,
            "avg_cost_per_fine_gram": round(avg_cost_per_fine_gram, 4),
            "earliest_purchase_date": g["earliest_date"],
            "position_count": len(g["positions"]),
            "positions": sorted(g["positions"], key=lambda p: (p["purchase_date"] or "")),
        })

        total_value += current_value
        total_cost += cost

    # Anteile fuers Kuchendiagramm
    for m in metals_out:
        m["allocation_pct"] = round((m["current_value"] / total_value * 100.0), 2) if total_value > 1e-9 else 0.0

    total_pnl = total_value - total_cost
    return {
        "metals": sorted(metals_out, key=lambda m: m["current_value"], reverse=True),
        "total_value": round(total_value, 2),
        "total_cost": round(total_cost, 2),
        "total_unrealized_pnl": round(total_pnl, 2),
        "total_unrealized_pnl_pct": round((total_pnl / total_cost * 100.0), 2) if total_cost > 1e-9 else 0.0,
    }


def gross_grams_round(g: float) -> float:
    return round(g, 3)


# ==========================================
# VALIDIERUNG
# ==========================================

def _validate(quantity=None, unit=None, fineness=None, purchase_price_eur=None, purchase_date=None):
    if quantity is not None and quantity <= 0:
        raise HTTPException(status_code=422, detail="Menge muss groesser als 0 sein.")
    if unit is not None and unit not in VALID_UNITS:
        raise HTTPException(status_code=422, detail="Einheit muss 'g', 'kg' oder 'oz' sein.")
    if fineness is not None and not (0 < fineness <= 1000):
        raise HTTPException(status_code=422, detail="Feingehalt muss zwischen 1 und 1000 (Promille) liegen.")
    if purchase_price_eur is not None and purchase_price_eur < 0:
        raise HTTPException(status_code=422, detail="Kaufpreis darf nicht negativ sein.")
    if purchase_date is not None:
        # Kaufdatum nicht in der Zukunft (kleiner Puffer fuer Zeitzonen).
        from datetime import timedelta
        if purchase_date.replace(tzinfo=None) > datetime.utcnow() + timedelta(days=1):
            raise HTTPException(status_code=422, detail="Kaufdatum darf nicht in der Zukunft liegen.")


# ==========================================
# API-ROUTEN
# ==========================================

@router.get("/metals")
def list_metals(current_user: User = Depends(get_current_user)):
    """Auswahlliste der unterstuetzten Metalle fuers Formular."""
    return [
        {"symbol": k, "name": v["name"], "default_unit": v["default_unit"]}
        for k, v in METALS.items()
    ]


# Vorlagen fuer gaengige Anlagemuenzen/-barren. Werte sind so gewaehlt, dass die
# FEINmenge stimmt (22-kt-Muenzen wie Kruegerrand/Eagle enthalten 1 oz FEINgold
# bei 916,7 ‰ -> Bruttogewicht ~33,93 g). Nach Auswahl im Formular frei aenderbar.
COIN_TEMPLATES = [
    {"id": "maple_gold",     "name": "Maple Leaf – Gold (1 oz)",            "metal": "XAU", "unit": "oz", "quantity": 1.0,  "fineness": 999.9},
    {"id": "phil_gold",      "name": "Wiener Philharmoniker – Gold (1 oz)", "metal": "XAU", "unit": "oz", "quantity": 1.0,  "fineness": 999.9},
    {"id": "britannia_gold", "name": "Britannia – Gold (1 oz)",             "metal": "XAU", "unit": "oz", "quantity": 1.0,  "fineness": 999.9},
    {"id": "kruger",         "name": "Krügerrand (1 oz Feingold)",          "metal": "XAU", "unit": "g",  "quantity": 33.93, "fineness": 916.7},
    {"id": "eagle_gold",     "name": "American Eagle – Gold (1 oz Feingold)","metal": "XAU", "unit": "g",  "quantity": 33.93, "fineness": 916.7},
    {"id": "bar_gold_100g",  "name": "Goldbarren 100 g",                    "metal": "XAU", "unit": "g",  "quantity": 100.0, "fineness": 999.9},
    {"id": "bar_gold_1kg",   "name": "Goldbarren 1 kg",                     "metal": "XAU", "unit": "kg", "quantity": 1.0,   "fineness": 999.9},
    {"id": "maple_silver",   "name": "Maple Leaf – Silber (1 oz)",          "metal": "XAG", "unit": "oz", "quantity": 1.0,  "fineness": 999.9},
    {"id": "phil_silver",    "name": "Wiener Philharmoniker – Silber (1 oz)","metal": "XAG", "unit": "oz", "quantity": 1.0,  "fineness": 999.0},
    {"id": "bar_silver_1kg", "name": "Silberbarren 1 kg",                   "metal": "XAG", "unit": "kg", "quantity": 1.0,   "fineness": 999.0},
]


@router.get("/templates")
def list_templates(current_user: User = Depends(get_current_user)):
    """Vorlagen fuer gaengige Anlagemuenzen/-barren (vorbefuellen, dann aenderbar)."""
    return COIN_TEMPLATES


@router.get("/summary")
def get_physical_summary(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    assets = session.exec(
        select(PhysicalAsset).where(PhysicalAsset.user_id == current_user.id)
    ).all()
    if not assets:
        return {
            "metals": [],
            "total_value": 0.0,
            "total_cost": 0.0,
            "total_unrealized_pnl": 0.0,
            "total_unrealized_pnl_pct": 0.0,
        }
    distinct_metals = [a.metal for a in assets]
    price_map = fetch_metal_prices(distinct_metals)
    return compute_physical_summary(assets, price_map)


@router.get("/price-history")
def get_price_history(
    metal: str,
    range: str = "1J",
    current_user: User = Depends(get_current_user),
):
    """Kursverlauf eines Metalls in EUR pro Gramm fuer den Detailchart."""
    metal = (metal or "").upper().strip()
    conf = METALS.get(metal)
    if not conf:
        # Freitext-Metall ohne Marktkurs -> kein Verlauf.
        return []

    period, interval = RANGE_PARAMS[_norm_range(range)]
    quote_grams = conf["quote_grams"]

    try:
        hist = yf.Ticker(conf["ticker"]).history(period=period, interval=interval)
    except Exception:
        return []
    if hist.empty:
        return []

    start_str = hist.index[0].strftime("%Y-%m-%d")
    end_str = (datetime.utcnow()).strftime("%Y-%m-%d")
    eurusd_hist = _fetch_eurusd_history(start_str, end_str)
    last_rate = _get_eurusd_rate()

    out: List[dict] = []
    for ts, usd in hist["Close"].items():
        date_str = ts.strftime("%Y-%m-%d")
        rate = eurusd_hist.get(date_str)
        if rate and rate > 0:
            last_rate = rate  # Forward-Fill fuer Tage ohne EUR/USD-Kurs
        try:
            eur_per_gram = (float(usd) / last_rate) / quote_grams
        except Exception:
            continue
        if eur_per_gram > 0:
            out.append({"date": date_str, "value": round(eur_per_gram, 6)})
    return out


@router.get("/")
def list_physical_assets(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return session.exec(
        select(PhysicalAsset)
        .where(PhysicalAsset.user_id == current_user.id)
        .order_by(PhysicalAsset.purchase_date.desc())
    ).all()


@router.post("/", response_model=PhysicalAsset)
def create_physical_asset(
    data: PhysicalAssetCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    metal = (data.metal or "").upper().strip()
    if not metal:
        raise HTTPException(status_code=422, detail="Metall fehlt.")
    _validate(
        quantity=data.quantity,
        unit=data.unit,
        fineness=data.fineness,
        purchase_price_eur=data.purchase_price_eur,
        purchase_date=data.purchase_date,
    )
    asset = PhysicalAsset(
        asset_class=data.asset_class or "metal",
        metal=metal,
        name=(data.name or METALS.get(metal, {}).get("name", metal)).strip(),
        quantity=data.quantity,
        unit=data.unit,
        fineness=data.fineness,
        purchase_price_eur=data.purchase_price_eur or 0.0,
        purchase_date=data.purchase_date,
        storage_location=(data.storage_location or None),
        note=(data.note or None),
        user_id=current_user.id,
    )
    session.add(asset)
    session.commit()
    session.refresh(asset)
    return asset


@router.put("/{asset_id}", response_model=PhysicalAsset)
def update_physical_asset(
    asset_id: int,
    data: PhysicalAssetUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    asset = session.exec(
        select(PhysicalAsset).where(
            PhysicalAsset.id == asset_id, PhysicalAsset.user_id == current_user.id
        )
    ).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Position nicht gefunden")

    _validate(
        quantity=data.quantity,
        unit=data.unit,
        fineness=data.fineness,
        purchase_price_eur=data.purchase_price_eur,
        purchase_date=data.purchase_date,
    )

    if data.metal is not None:
        asset.metal = data.metal.upper().strip()
    if data.name is not None:
        asset.name = data.name.strip()
    if data.quantity is not None:
        asset.quantity = data.quantity
    if data.unit is not None:
        asset.unit = data.unit
    if data.fineness is not None:
        asset.fineness = data.fineness
    if data.purchase_price_eur is not None:
        asset.purchase_price_eur = data.purchase_price_eur
    if data.purchase_date is not None:
        asset.purchase_date = data.purchase_date
    # Lagerort/Notiz: leerer String -> als „nicht gesetzt" speichern.
    if data.storage_location is not None:
        asset.storage_location = data.storage_location.strip() or None
    if data.note is not None:
        asset.note = data.note.strip() or None

    session.add(asset)
    session.commit()
    session.refresh(asset)
    return asset


@router.delete("/{asset_id}")
def delete_physical_asset(
    asset_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    asset = session.exec(
        select(PhysicalAsset).where(
            PhysicalAsset.id == asset_id, PhysicalAsset.user_id == current_user.id
        )
    ).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Position nicht gefunden")
    session.delete(asset)
    session.commit()
    return {"status": "ok"}
