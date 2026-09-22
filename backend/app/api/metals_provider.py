"""Gemeinsame Provider-Schnittstelle fuer Metall-SPOT-Kurse.

Aktuell: metals.dev (Gratis-Tarif, 100 Requests/Monat) fuer echten Spot in EUR,
mit Cache (schont das Kontingent) und Monats-Zaehler. Historischer Spot zum
Kaufdatum (fuers Aufgeld) via timeseries (max. 30 Tage, USD -> EUR ueber yfinance).

Design: bewusst OHNE Import aus physical.py (nur portfolio-Helfer), damit
physical.py diesen Provider importieren kann und ein spaeterer Anbieterwechsel
nur diese Datei betrifft. Einheitliche Rueckgabe: EUR pro Gramm + Quote-Zeit + Quelle.
"""

from __future__ import annotations

import os
import json
from datetime import datetime, timezone, timedelta, date
from typing import Dict, List, Optional

import requests as http_requests
from sqlmodel import Session

from backend.app.db.database import engine
from backend.app.db.models import PriceCache
from backend.app.api.portfolio import _get_eurusd_rate, _fetch_eurusd_history

METALS_DEV_BASE = "https://api.metals.dev/v1"
SPOT_TTL = timedelta(hours=8)          # Cache-Dauer fuer den aktuellen Spot
MONTHLY_LIMIT = 95                     # Puffer unter dem 100/Monat-Gratislimit
GRAMS_PER_TROY_OUNCE = 31.1034768

# Unsere Symbole <-> metals.dev-Namen
DEV_NAME = {"XAU": "gold", "XAG": "silver", "XPT": "platinum", "XPD": "palladium", "XCU": "copper"}
PRECIOUS = {"XAU", "XAG", "XPT", "XPD"}


def _api_key() -> Optional[str]:
    return os.getenv("METALS_DEV_API_KEY")


def is_configured() -> bool:
    return bool(_api_key())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------- Cache (Postgres/SQLite via PriceCache) ----------

def _cache_get(key: str):
    try:
        with Session(engine) as s:
            row = s.get(PriceCache, key)
            if row:
                return row.data, row.updated_at
    except Exception:
        pass
    return None, None


def _cache_set(key: str, data_str: str) -> None:
    try:
        with Session(engine) as s:
            row = s.get(PriceCache, key)
            now = _now().replace(tzinfo=None)
            if row:
                row.data = data_str
                row.updated_at = now
            else:
                row = PriceCache(key=key, data=data_str, updated_at=now)
            s.add(row)
            s.commit()
    except Exception:
        pass


# ---------- Kontingent-Zaehler (pro Monat) ----------

def _usage_key() -> str:
    return "metalsdev_usage_" + _now().strftime("%Y-%m")


def usage_count() -> int:
    d, _ = _cache_get(_usage_key())
    try:
        return int(json.loads(d)["count"]) if d else 0
    except Exception:
        return 0


def _usage_inc(n: int = 1) -> int:
    c = usage_count() + n
    _cache_set(_usage_key(), json.dumps({"count": c}))
    return c


def usage_status() -> dict:
    return {"used": usage_count(), "limit": MONTHLY_LIMIT, "month": _now().strftime("%Y-%m")}


# ---------- Kupfer: robust auf EUR/Gramm bringen ----------

def _copper_eur_per_gram(raw: float) -> Optional[float]:
    """metals.dev liefert Kupfer je nach Einheit (Tonne/toz/kg). Waehle die
    Interpretation, die einen plausiblen Kupfer-Grammpreis (0,001–0,1 €/g) ergibt."""
    try:
        raw = float(raw)
    except Exception:
        return None
    for cand in (raw / 1_000_000.0, raw / GRAMS_PER_TROY_OUNCE, raw / 1000.0, raw):
        if 0.001 <= cand <= 0.1:
            return cand
    return None


def _to_eur_per_gram(sym: str, value: float) -> Optional[float]:
    """Antwortwert (EUR pro toz fuer Edelmetalle) -> EUR/Gramm."""
    if sym in PRECIOUS:
        v = value / GRAMS_PER_TROY_OUNCE
        return v if v > 0 else None
    return _copper_eur_per_gram(value)


# ---------- metals.dev: aktueller Spot (ein Sammel-Request) ----------

def _fetch_latest():
    """/v1/latest?currency=EUR&unit=toz -> ({sym: eur_per_gram}, quote_time_iso) | (None, None)."""
    key = _api_key()
    if not key or usage_count() >= MONTHLY_LIMIT:
        return None, None
    try:
        r = http_requests.get(
            f"{METALS_DEV_BASE}/latest",
            params={"api_key": key, "currency": "EUR", "unit": "toz"},
            timeout=15,
        )
        _usage_inc(1)
        j = r.json()
        if j.get("status") != "success":
            return None, None
        metals = j.get("metals", {}) or {}
        qt = (j.get("timestamps", {}) or {}).get("metal")
        out: Dict[str, float] = {}
        for sym, name in DEV_NAME.items():
            v = metals.get(name)
            if v is None:
                continue
            ppg = _to_eur_per_gram(sym, float(v))
            if ppg and ppg > 0:
                out[sym] = ppg
        return (out or None), qt
    except Exception:
        return None, None


def get_current_spot(metals: List[str]) -> Dict[str, dict]:
    """Aktueller Spot EUR/g je Metall: {sym: {price_per_gram, quote_time, source}}.

    Nutzt den Cache (TTL 8 h; am Wochenende kein Neu-Abruf). Bei Limit/Fehler wird
    der letzte bekannte Cache zurueckgegeben. Leeres Dict -> kein Spot (Aufrufer
    faellt auf den Future zurueck).
    """
    wanted = [m for m in set(metals) if m in DEV_NAME]
    if not wanted or not _api_key():
        return {}

    data_str, updated = _cache_get("metals_spot")
    cached = None
    if data_str:
        try:
            cached = json.loads(data_str)
        except Exception:
            cached = None

    need_refresh = True
    if cached and updated:
        age = _now() - updated.replace(tzinfo=timezone.utc)
        if age < SPOT_TTL or _now().weekday() >= 5:  # frisch genug ODER Wochenende
            need_refresh = False

    if need_refresh:
        prices, qt = _fetch_latest()
        if prices:
            cached = {"prices": prices, "quote_time": qt}
            _cache_set("metals_spot", json.dumps(cached))

    if not cached:
        return {}

    prices = cached.get("prices", {}) or {}
    qt = cached.get("quote_time")
    out: Dict[str, dict] = {}
    for m in wanted:
        p = prices.get(m)
        if p and p > 0:
            out[m] = {"price_per_gram": float(p), "quote_time": qt, "source": "spot"}
    return out


# ---------- metals.dev: historischer Spot zum Kaufdatum (Aufgeld) ----------

def historical_spot_at(metal: str, day: date) -> Optional[float]:
    """Spot EUR/g eines Metalls zum Datum (nur <=30 Tage her, via timeseries USD).
    None, wenn ausserhalb des Fensters, kein Key, Limit erreicht oder nicht verfuegbar."""
    if metal not in DEV_NAME or not _api_key():
        return None
    today = _now().date()
    if day > today or (today - day).days > 30:
        return None
    if usage_count() >= MONTHLY_LIMIT:
        return None

    name = DEV_NAME[metal]
    start = (day - timedelta(days=4)).strftime("%Y-%m-%d")
    end = (day + timedelta(days=1)).strftime("%Y-%m-%d")
    try:
        r = http_requests.get(
            f"{METALS_DEV_BASE}/timeseries",
            params={"api_key": _api_key(), "start_date": start, "end_date": end, "unit": "toz"},
            timeout=15,
        )
        _usage_inc(1)
        j = r.json()
        if j.get("status") != "success":
            return None
        rates = j.get("rates", {}) or {}
        target = day.strftime("%Y-%m-%d")
        chosen = None
        for d in sorted(rates.keys(), reverse=True):
            if d <= target:
                chosen = rates[d]
                break
        if not chosen:
            return None
        usd = (chosen.get("metals", {}) or {}).get(name)
        if usd is None:
            return None
        usd = float(usd)
        eur_hist = _fetch_eurusd_history(start, end)
        rate = eur_hist.get(target) or _get_eurusd_rate()
        if metal in PRECIOUS:
            v = (usd / rate) / GRAMS_PER_TROY_OUNCE
            return v if v > 0 else None
        return _copper_eur_per_gram(usd / rate)
    except Exception:
        return None
