"""Tests fuer die Umrechnungen der physischen Werte (Edelmetalle).

Deckt oz<->g, Feinmenge bei 999 / 999,9 / 925 ‰ und eine Beispielrechnung
Maple Leaf (1 oz @ 999,9 ‰ = 31,1004 g Feingold) ab.

Laufen mit pytest ODER direkt:  python backend/tests/test_physical_conversions.py
"""

import os
import sys
from datetime import datetime

# Repo-Root auf den Importpfad (damit "python backend/tests/..." und pytest laufen)
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from backend.app.api.physical import (  # noqa: E402
    fine_grams_of,
    gross_grams_of,
    compute_physical_summary,
    GRAMS_PER_TROY_OUNCE,
    GRAMS_PER_POUND,
)
from backend.app.db.models import PhysicalAsset  # noqa: E402

OZ = GRAMS_PER_TROY_OUNCE


def test_oz_to_grams():
    assert abs(gross_grams_of(1, "oz") - 31.1034768) < 1e-9
    assert abs(gross_grams_of(2, "oz") - 62.2069536) < 1e-9


def test_grams_and_kg():
    assert gross_grams_of(500, "g") == 500.0
    assert gross_grams_of(2, "kg") == 2000.0


def test_fine_amount_various_fineness():
    # 999 ‰
    assert abs(fine_grams_of(1, "oz", 999.0) - OZ * 0.999) < 1e-9
    # 999,9 ‰ (Dezimal muss verlustfrei sein)
    assert abs(fine_grams_of(1, "oz", 999.9) - OZ * 0.9999) < 1e-9
    # 925 ‰ (Silber)
    assert abs(fine_grams_of(1, "kg", 925.0) - 925.0) < 1e-9


def test_maple_leaf_31_1004():
    """1 oz Gold Maple Leaf @ 999,9 ‰ ergibt exakt 31,1004 g Feingold."""
    fine = fine_grams_of(1, "oz", 999.9)
    assert round(fine, 4) == 31.1004


def test_copper_uses_pound_not_ounce():
    # Kupfer wird pro Pfund notiert -> quote_grams muss das Pfund sein.
    assert abs(GRAMS_PER_POUND - 453.59237) < 1e-9
    assert GRAMS_PER_POUND != OZ


def test_no_rounding_in_value_chain():
    """Wert = Feinmenge(voll) * Kurs(voll); nur die Ausgabe wird gerundet."""
    a = [PhysicalAsset(id=1, metal="XAU", name="Gold", quantity=1, unit="oz",
                       fineness=999.9, purchase_price_eur=2000.0,
                       purchase_date=datetime(2026, 9, 16))]
    price = {"XAU": {"price_per_gram": 121.99, "price_per_ounce": 121.99 * OZ,
                     "quote_time": "2026-09-16T18:28:41+00:00", "market_state": "REGULAR",
                     "is_live": True, "has_market_price": True}}
    s = compute_physical_summary(a, price)
    m = s["metals"][0]
    assert m["fine_grams"] == 31.1004
    # Wert = 31.1004 * 121.99 (volle Praezision), auf 2 gerundet
    assert m["current_value"] == round(31.1034768 * 0.9999 * 121.99, 2)
    assert m["price_is_live"] is True
    assert m["price_market_state"] == "REGULAR"


def test_copper_tonne_and_toz_to_gram():
    """Kupfer robust auf plausible €/g (0,001–0,1): aus €/Tonne und €/toz."""
    from backend.app.api import metals_provider as mp
    assert abs(mp._copper_eur_per_gram(9000.0) - 0.009) < 1e-9        # 9000 €/t -> 0,009 €/g
    assert 0.011 < mp._copper_eur_per_gram(0.38) < 0.013             # 0,38 €/toz -> ~0,0122 €/g
    assert mp._copper_eur_per_gram(999999.0) is None                 # unplausibel -> None


def test_precious_toz_to_gram():
    from backend.app.api import metals_provider as mp
    assert abs(mp._to_eur_per_gram("XAU", 3742.0) - 3742.0 / OZ) < 1e-9


def test_no_key_no_spot():
    """Ohne METALS_DEV_API_KEY liefert der Provider keinen Spot (Future-Fallback greift)."""
    import os
    from backend.app.api import metals_provider as mp
    os.environ.pop("METALS_DEV_API_KEY", None)
    assert mp.get_current_spot(["XAU"]) == {}


def test_aufgeld():
    """Aufgeld = Kaufpreis - Feinmenge * Spot(Kaufdatum); neutral, aus echtem Spot."""
    a = [PhysicalAsset(id=1, metal="XAU", name="Gold", quantity=1, unit="oz",
                       fineness=999.9, purchase_price_eur=2000.0,
                       purchase_date=datetime(2026, 9, 16),
                       purchase_spot_eur_per_gram=60.0, purchase_spot_source="auto")]
    price = {"XAU": {"price_per_gram": 120.0, "price_per_ounce": 120.0 * OZ,
                     "quote_time": "2026-09-22T10:00:00+00:00", "is_live": True,
                     "source": "spot", "has_market_price": True}}
    m = compute_physical_summary(a, price)["metals"][0]
    fine = 31.1034768 * 0.9999
    assert m["premium_eur"] == round(2000.0 - fine * 60.0, 2)
    assert m["premium_source"] == "auto"
    assert m["price_source"] == "spot"


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for fn in fns:
        fn()
        print(f"OK  {fn.__name__}")
    print(f"\n{len(fns)} Tests bestanden.")
