from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

import requests as http_requests
import yfinance as yf
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel

from backend.app.api.auth import get_current_user
from backend.app.db.database import engine
from backend.app.db.models import Trade, TradeCreate, User
from backend.app.db.models import Trade, TradeCreate, User, Transaction

router = APIRouter()

# ---------- CoinGecko: Symbol -> Coin-ID ----------
CRYPTO_ID_MAP = {
    # --- Top 20 & Stablecoins ---
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "USDT": "tether",
    "BNB": "binancecoin",
    "SOL": "solana",
    "USDC": "usd-coin",
    "XRP": "ripple",
    "TON": "the-open-network",
    "DOGE": "dogecoin",
    "ADA": "cardano",
    "SHIB": "shiba-inu",
    "AVAX": "avalanche-2",
    "DOT": "polkadot",
    "BCH": "bitcoin-cash",
    "LINK": "chainlink",
    "TRX": "tron",
    "MATIC": "matic-network",
    "NEAR": "near",
    "LTC": "litecoin",
    "ICP": "internet-computer",
    "DAI": "dai",
    "UNI": "uniswap",

    # --- Layer 1 & Layer 2 Chains ---
    "QUBIC": "qubic",
    "APT": "aptos",
    "SUI": "sui",
    "STX": "blockstack",
    "XLM": "stellar",
    "ATOM": "cosmos",
    "MNT": "mantle",
    "HBAR": "hedera-hashgraph",
    "CRO": "crypto-com-chain",
    "ETC": "ethereum-classic",
    "KAS": "kaspa",
    "VET": "vechain",
    "OP": "optimism",
    "ARB": "arbitrum",
    "FTM": "fantom",
    "ALGO": "algorand",
    "SEI": "sei-network",
    "EGLD": "elrond-erd-2",
    "FLOW": "flow",
    "XTZ": "tezos",
    "NEO": "neo",
    "EOS": "eos",
    "IOTA": "iota",
    "ZIL": "zilliqa",
    "CELO": "celo",
    "ROSE": "oasis-network",
    "GLMR": "moonbeam",
    "ONE": "harmony",
    "KSM": "kusama",
    "CSPR": "casper-network",
    "ICX": "icon",
    "ONT": "ontology",

    # --- AI, Data & DePIN (inklusive TAO) ---
    "TAO": "bittensor",
    "GRT": "the-graph",
    "RNDR": "render-token",
    "FIL": "filecoin",
    "THETA": "theta-token",
    "FET": "fetch-ai",
    "AGIX": "singularitynet",
    "OCEAN": "ocean-protocol",
    "AR": "arweave",
    "AKT": "akash-network",
    "JASMY": "jasmycoin",
    "GLM": "golem",
    "SC": "siacoin",

    # --- Memecoins ---
    "PEPE": "pepe",
    "WIF": "dogwifcoin",
    "FLOKI": "floki",
    "BONK": "bonk",
    "BOME": "book-of-meme",
    "MEME": "memecoin-2",

    # --- DeFi & Exchanges ---
    "MKR": "maker",
    "INJ": "injective-protocol",
    "LDO": "lido-dao",
    "RUNE": "thorchain",
    "AAVE": "aave",
    "SNX": "synthetix-network-token",
    "CRV": "curve-dao-token",
    "COMP": "compound-governance-token",
    "CAKE": "pancakeswap-token",
    "1INCH": "1inch",
    "GMX": "gmx",
    "LRC": "loopring",
    "FXS": "frax-share",
    "YFI": "yearn-finance",
    "TWT": "trust-wallet-token",
    "NEXO": "nexo",
    "ENS": "ethereum-name-service",
    "SSV": "ssv-network",
    "RPL": "rocket-pool",
    "GNO": "gnosis",
    "BAL": "balancer",
    "BNT": "bancor",
    "REQ": "request-network",
    "PENDLE": "pendle",
    "ONDO": "ondo-finance",
    "JTO": "jito-governance-token",
    "PYTH": "pyth-network",
    "DYDX": "dydx",
    "SUSHI": "sushi",
    "RAY": "raydium",

    # --- Gaming, Metaverse & NFTs ---
    "IMX": "immutable-x",
    "SAND": "the-sandbox",
    "AXS": "axie-infinity",
    "CHZ": "chiliz",
    "MANA": "decentraland",
    "ENJ": "enjincoin",
    "ILV": "illuvium",
    "BEAM": "beam-2",
    "GALA": "gala",
    "BLUR": "blur",
    "YGG": "yield-guild-games",
    "MAGIC": "magic",
    "APE": "apecoin",
    "WAXP": "wax",
    "SLP": "smooth-love-potion",

    # --- Privacy & Older Coins ---
    "XMR": "monero",
    "ZEC": "zcash",
    "DASH": "dash",
    "BSV": "bitcoin-cash-sv",
    "XEC": "ecash",
    "BAT": "basic-attention-token",
    "RVN": "ravencoin",
    "DCR": "decred",
    "XEM": "nem",
    "QTUM": "qtum",
    "ZRX": "0x",
    "LSK": "lisk",

    # --- Neue / Trending Projects (2023-2024) ---
    "TIA": "celestia",
    "ORDI": "ordinals",
    "STRK": "starknet",
    "WLD": "worldcoin-wld",
    "ZETA": "zetachain",
    "ALT": "altlayer",
    "MANTA": "manta-network",
    "DYM": "dymension",
    "ENA": "ethena",
    "W": "wormhole",
    "TNSR": "tensor",
    "AEVO": "aevo",

    # --- Erweiterung 1: Solana Ecosystem (DeFi, DePIN & NFTs) ---
    "RAY": "raydium",
    "ORCA": "orca",
    "SRM": "serum",
    "FIDA": "bonfida",
    "MNGO": "mango-markets",
    "SBR": "saber",
    "MOBILE": "helium-mobile",
    "IOT": "helium-iot",
    "HONEY": "hivemapper",
    "DIMO": "dimo",
    "ATLAS": "star-atlas",
    "POLIS": "star-atlas-dao",

    # --- Erweiterung 2: Cosmos & Polkadot Ecosystem ---
    "OSMO": "osmosis",
    "SCRT": "secret",
    "KAVA": "kava",
    "CTK": "certik",
    "IRIS": "iris-network",
    "EVMOS": "evmos",
    "CANTO": "canto",
    "ASTR": "astar",
    "ACA": "acala",
    "MOVR": "moonriver",
    "CFG": "centrifuge",
    "BNC": "bifrost-native-coin",
    "PHA": "phala-network",

    # --- Erweiterung 3: Alte OGs, Proof-of-Work & Layer 1s ---
    "HNT": "helium",
    "MINA": "mina-protocol",
    "KDA": "kadena",
    "FLUX": "zelcash",
    "ERG": "ergo",
    "NEXA": "nexa",
    "DNX": "dynex",
    "XNO": "nano",
    "DGB": "digibyte",
    "SYS": "syscoin",
    "ZEN": "horizen",
    "CKB": "nervos-network",
    "GAS": "gas",
    "ONG": "ontology-gas",
    "VTHO": "vethor-token",
    "XCH": "chia",

    # --- Erweiterung 4: Web3, Storage, Orakel & Infrastruktur ---
    "STORJ": "storj",
    "SNT": "status",
    "CVC": "civic",
    "POWR": "power-ledger",
    "RLC": "iexec-rlc",
    "NMR": "numeraire",
    "KNC": "kyber-network-crystal",
    "ANT": "aragon",
    "MLN": "enzyme",
    "REN": "republic-protocol",
    "UMA": "uma",
    "BAND": "band-protocol",
    "API3": "api3",
    "DIA": "dia-data",
    "TRB": "tellor",
    "OXT": "orchid-protocol",
    "LPT": "livepeer",
    "AUDIO": "audius",
    "BICO": "biconomy",
    "CTSI": "cartesi",
    "CELR": "celer-network",
    "SKL": "skale",
    "COTI": "coti",

    # --- Erweiterung 5: Gaming, Metaverse & Gilden ---
    "SUPER": "superfarm",
    "UOS": "ultra",
    "PYR": "vulcan-forged",
    "ALICE": "my-neighbor-alice",
    "DAR": "mines-of-dalarnia",
    "TLM": "alien-worlds",
    "MC": "merit-circle",
    "PLA": "playdapp",

    # --- Erweiterung 6: Spezielle DeFi & Yield Token ---
    "FORTH": "ampleforth-governance-token",
    "AMPL": "ampleforth",
    "BADGER": "badger-dao",
    "FARM": "harvest-finance",
    "ALCX": "alchemix",
    "CVX": "convex-finance",
    "SPELL": "spell-token",
    "MIM": "magic-internet-money",
    "JOE": "joe",
    "PNG": "pangolin",
    "QI": "benqi",
    "XVS": "venus",
    "ALPHA": "alpha-finance",

    # --- Erweiterung 7: Tron Ecosystem & Terra/Luna ---
    "LUNC": "terra-luna",
    "USTC": "terrausd",
    "LUNA": "terra-luna-2",
    "BTT": "bittorrent",
    "JST": "just",
    "SUN": "sun-token",
    "WIN": "wink",

    # --- Erweiterung 8: Exchange & Wallet Token ---
    "C98": "coin98",
    "SFP": "safepal",
    "ACH": "alchemy-pay"
}

# ---------- DB-Session ----------

def get_session():
    with Session(engine) as session:
        yield session


# ==========================================
# INTERNE HILFSFUNKTIONEN
# ==========================================

def _to_date(dt):
    return dt.date() if isinstance(dt, datetime) else dt


def _get_eurusd_rate() -> float:
    """Aktueller EUR/USD-Wechselkurs. Fallback: 1.09."""
    try:
        rate = getattr(yf.Ticker("EURUSD=X").fast_info, "last_price", None)
        val = float(rate) if rate else 0.0
        return val if val > 0 else 1.09
    except Exception:
        return 1.09


def _native_to_eur(price: float, currency: str, eurusd: float) -> float:
    """Konvertiert einen Kurs aus der Leitwaehrung in EUR.

    Fuer EUR-Werte ist keine Umrechnung noetig.
    Fuer alle anderen Waehrungen (USD, GBP, CHF …) wird naeherungsweise
    durch den EUR/USD-Kurs dividiert – fuer ein persoenliches Dashboard
    ausreichend genau.
    """
    if currency == "EUR":
        return price
    return price / eurusd


def _stock_price_eur(symbol: str, eurusd: float) -> float:
    """Gibt den aktuellen Kurs eines Wertpapiers in EUR zurueck."""
    try:
        fi = yf.Ticker(symbol).fast_info
        price = float(getattr(fi, "last_price", None) or 0.0)
        if price == 0.0:
            return 0.0
        currency = getattr(fi, "currency", "USD").upper()
        return _native_to_eur(price, currency, eurusd)
    except Exception:
        return 0.0


def fetch_live_prices(symbols_by_type: Dict[str, str]) -> Dict[str, float]:
    """Gibt aktuelle Kurse aller Assets in EUR zurueck."""
    prices: Dict[str, float] = {}

    stock_syms  = [s for s, t in symbols_by_type.items() if t == "stock"]
    crypto_syms = [s for s, t in symbols_by_type.items() if t == "crypto"]

    # ---- Aktien: einmal EUR/USD holen, dann pro Symbol konvertieren ----
    if stock_syms:
        eurusd = _get_eurusd_rate()
        for sym in stock_syms:
            prices[sym] = _stock_price_eur(sym, eurusd)

    # ---- Krypto: CoinGecko liefert direkt EUR ----
    if crypto_syms:
        ids = [CRYPTO_ID_MAP.get(s.upper(), s.lower()) for s in crypto_syms]
        try:
            resp = http_requests.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={"ids": ",".join(ids), "vs_currencies": "eur"},
                timeout=10,
            )
            data = resp.json()
            for sym, coin_id in zip(crypto_syms, ids):
                prices[sym] = float(data.get(coin_id, {}).get("eur", 0.0))
        except Exception:
            for sym in crypto_syms:
                prices.setdefault(sym, 0.0)

    return prices


def _fetch_eurusd_history(start_str: str, end_str: str) -> Dict[str, float]:
    """Tagesweise EUR/USD-Kurse fuer einen Zeitraum. Fallback: leeres Dict."""
    try:
        hist = yf.Ticker("EURUSD=X").history(start=start_str, end=end_str)
        if not hist.empty:
            return {
                d.strftime("%Y-%m-%d"): float(v)
                for d, v in hist["Close"].items()
            }
    except Exception:
        pass
    return {}


def fetch_price_history(
    symbols_by_type: Dict[str, str], start_date: datetime
) -> Dict[str, Dict[str, float]]:
    """
    Historische Tagesschlusskurse aller Assets in EUR.
    Aktien-USD-Kurse werden mit dem historischen EUR/USD-Kurs umgerechnet;
    Fallback ist der aktuelle Kurs.
    """
    all_prices: Dict[str, Dict[str, float]] = {}
    start_str = _to_date(start_date).strftime("%Y-%m-%d")
    end_str   = datetime.utcnow().strftime("%Y-%m-%d")

    stock_syms = [s for s, t in symbols_by_type.items() if t == "stock"]

    # EUR/USD-Verlauf (ein einziger Aufruf fuer alle Aktien)
    eurusd_hist:     Dict[str, float] = {}
    eurusd_fallback: float            = _get_eurusd_rate()
    if stock_syms:
        eurusd_hist = _fetch_eurusd_history(start_str, end_str)

    for sym, asset_type in symbols_by_type.items():
        if asset_type == "stock":
            try:
                ticker = yf.Ticker(sym)
                hist   = ticker.history(start=start_str, end=end_str)
                if not hist.empty:
                    currency = getattr(ticker.fast_info, "currency", "USD").upper()
                    sym_prices: Dict[str, float] = {}
                    for d, v in hist["Close"].items():
                        date_str = d.strftime("%Y-%m-%d")
                        price    = float(v)
                        if currency != "EUR":
                            rate  = eurusd_hist.get(date_str, eurusd_fallback)
                            price = price / rate
                        sym_prices[date_str] = price
                    all_prices[sym] = sym_prices
            except Exception:
                pass

        else:  # crypto
            coin_id = CRYPTO_ID_MAP.get(sym.upper(), sym.lower())
            try:
                resp = http_requests.get(
                    f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart",
                    params={"vs_currency": "eur", "days": "365"},
                    timeout=15,
                )
                raw = resp.json().get("prices", [])
                all_prices[sym] = {
                    datetime.utcfromtimestamp(ts / 1000).strftime("%Y-%m-%d"): price
                    for ts, price in raw
                }
            except Exception:
                pass

    return all_prices


def compute_holdings_at(trades: List[Trade], up_to_date=None) -> Dict[str, float]:
    holdings: Dict[str, float] = {}
    for trade in sorted(trades, key=lambda t: t.date):
        if up_to_date and _to_date(trade.date) > up_to_date:
            continue
        holdings.setdefault(trade.symbol, 0.0)
        if trade.trade_type == "BUY":
            holdings[trade.symbol] += trade.quantity
        else:
            holdings[trade.symbol] -= trade.quantity
    return {s: q for s, q in holdings.items() if q > 1e-8}


def compute_portfolio_summary(trades: List[Trade], live_prices: Dict[str, float]) -> dict:
    """
    Berechnet Portfolio-KPIs aus einer Liste von Trades und Live-Kursen (alle in EUR).

    Kostenbasis-Tracking:
      - cost_basis_qty / cost_basis_cost repraesentieren die *verbleibenden* Anteile
        und deren gewichteten Durchschnittskaufpreis (WAVG).
      - Bei einem SELL wird die Kostenbasis proportional reduziert, sodass der
        Durchschnittskaufpreis der verbliebenen Anteile korrekt bleibt.
      - Kein Unterlauffschutz: Wenn mehr verkauft wird als gehalten (Datenfehler),
        wird sell_qty auf den verbleibenden Bestand begrenzt.
    """
    asset_data: Dict[str, dict] = {}

    for trade in sorted(trades, key=lambda t: t.date):
        sym = trade.symbol
        if sym not in asset_data:
            asset_data[sym] = {
                "asset_name":          trade.asset_name,
                "asset_type":          trade.asset_type,
                "cost_basis_qty":      0.0,   # verbleibende Anteile fuer WAVG
                "cost_basis_cost":     0.0,   # Gesamtkostenbasis der verbleibenden Anteile
                "current_qty":         0.0,
                "realized_pnl":        0.0,
                "total_sell_proceeds": 0.0,   # fuer realized P&L %
                "total_sell_cost":     0.0,   # fuer realized P&L %
            }
        a = asset_data[sym]

        if trade.trade_type == "BUY":
            a["cost_basis_qty"]  += trade.quantity
            a["cost_basis_cost"] += trade.quantity * trade.price_per_unit
            a["current_qty"]     += trade.quantity

        else:  # SELL
            # Schutz vor Datenfehlern: nicht mehr verkaufen als aktuell vorhanden
            sell_qty = min(trade.quantity, a["cost_basis_qty"]) if a["cost_basis_qty"] > 1e-8 else 0.0
            avg_cost = (a["cost_basis_cost"] / a["cost_basis_qty"]
                        if a["cost_basis_qty"] > 1e-8 else 0.0)

            realized = (trade.price_per_unit - avg_cost) * sell_qty
            a["realized_pnl"]        += realized
            a["total_sell_proceeds"] += trade.price_per_unit * sell_qty
            a["total_sell_cost"]     += avg_cost * sell_qty

            # Kostenbasis proportional reduzieren
            if a["cost_basis_qty"] > 1e-8:
                frac = sell_qty / a["cost_basis_qty"]
                a["cost_basis_cost"] = a["cost_basis_cost"] * (1.0 - frac)
                a["cost_basis_qty"]  = a["cost_basis_qty"]  - sell_qty
                # Floating-Point-Bereinigung
                if a["cost_basis_qty"] < 1e-8:
                    a["cost_basis_qty"]  = 0.0
                    a["cost_basis_cost"] = 0.0

            a["current_qty"] = max(0.0, a["current_qty"] - trade.quantity)

    # ---- Aggregation ----
    holdings:                   list  = []
    total_value:                float = 0.0
    total_invested:             float = 0.0
    total_realized_pnl:         float = 0.0
    total_sell_proceeds_all:    float = 0.0
    total_sell_cost_all:        float = 0.0

    for sym, a in asset_data.items():
        total_realized_pnl      += a["realized_pnl"]
        total_sell_proceeds_all += a["total_sell_proceeds"]
        total_sell_cost_all     += a["total_sell_cost"]

        if a["current_qty"] < 1e-8:
            continue  # vollstaendig verkaufte Position

        current_price    = live_prices.get(sym, 0.0)
        avg_buy_in       = (a["cost_basis_cost"] / a["cost_basis_qty"]
                            if a["cost_basis_qty"] > 1e-8 else 0.0)
        invested         = a["current_qty"] * avg_buy_in
        current_value    = a["current_qty"] * current_price
        unrealized_pnl   = current_value - invested
        unrealized_pnl_pct = (unrealized_pnl / invested * 100) if invested > 1e-8 else 0.0

        holdings.append({
            "symbol":             sym,
            "asset_name":         a["asset_name"],
            "asset_type":         a["asset_type"],
            "quantity":           a["current_qty"],
            "avg_buy_in":         avg_buy_in,
            "current_price":      current_price,
            "current_value":      current_value,
            "invested":           invested,
            "unrealized_pnl":     unrealized_pnl,
            "unrealized_pnl_pct": unrealized_pnl_pct,
            "realized_pnl":       a["realized_pnl"],
        })
        total_value    += current_value
        total_invested += invested

    total_unrealized_pnl = total_value - total_invested
    total_pnl_pct = (total_unrealized_pnl / total_invested * 100) if total_invested > 1e-8 else 0.0

    # Realized P&L in % des eingesetzten Kapitals bei verkauften Positionen
    total_realized_pnl_pct = (
        (total_sell_proceeds_all - total_sell_cost_all) / total_sell_cost_all * 100
        if total_sell_cost_all > 1e-8 else 0.0
    )

    return {
        "holdings":               sorted(holdings, key=lambda h: h["current_value"], reverse=True),
        "total_value":            total_value,
        "total_invested":         total_invested,
        "total_unrealized_pnl":   total_unrealized_pnl,
        "total_realized_pnl":     total_realized_pnl,
        "total_realized_pnl_pct": total_realized_pnl_pct,
        "total_pnl_pct":          total_pnl_pct,
    }


# ==========================================
# API-ROUTEN
# ==========================================


@router.get("/search")
def search_assets(
    query: str,
    current_user: User = Depends(get_current_user),
):
    """
    Sucht gleichzeitig nach Aktien/ETFs (Yahoo Finance) und Kryptowaehrungen (CoinGecko).
    Gibt eine kombinierte Trefferliste zurueck.
    """
    results: List[dict] = []

    # ---- Aktien & ETFs via Yahoo Finance ----
    try:
        resp = http_requests.get(
            "https://query2.finance.yahoo.com/v1/finance/search",
            params={"q": query, "quotesCount": 8, "newsCount": 0, "listsCount": 0},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=5,
        )
        for q in resp.json().get("quotes", []):
            if q.get("quoteType") not in ("EQUITY", "ETF"):
                continue
            name = q.get("longname") or q.get("shortname") or q.get("symbol", "")
            results.append({
                "symbol":     q.get("symbol", ""),
                "name":       name,
                "asset_type": "stock",
                "exchange":   q.get("exchDisp") or q.get("exchange", ""),
                "coin_id":    None,
            })
    except Exception:
        pass

    # ---- Kryptowaehrungen via CoinGecko ----
    try:
        resp = http_requests.get(
            "https://api.coingecko.com/api/v3/search",
            params={"query": query},
            timeout=5,
        )
        for coin in resp.json().get("coins", [])[:5]:
            results.append({
                "symbol":     coin.get("symbol", "").upper(),
                "name":       coin.get("name", ""),
                "asset_type": "crypto",
                "exchange":   "CoinGecko",
                "coin_id":    coin.get("id", ""),
            })
    except Exception:
        pass

    return results


@router.get("/lookup")
def lookup_asset(
    symbol: str,
    asset_type: str,
    coin_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """Gibt Name, Logo-URL und aktuellen Kurs (USD + EUR) fuer ein Symbol zurueck."""
    symbol = symbol.upper().strip()

    if asset_type == "stock":
        try:
            ticker = yf.Ticker(symbol)
            fi = ticker.fast_info
            native_price = float(getattr(fi, "last_price", None) or 0.0)

            try:
                info       = ticker.info
                name       = info.get("longName") or info.get("shortName") or symbol
                logo_url   = info.get("logo_url", "")
                native_cur = info.get("currency", "USD").upper()
            except Exception:
                name       = symbol
                logo_url   = ""
                native_cur = getattr(fi, "currency", "USD").upper()

            if native_price == 0.0:
                raise HTTPException(
                    status_code=404,
                    detail=f"Kurs fuer '{symbol}' nicht gefunden – Symbol pruefen.",
                )

            eurusd    = _get_eurusd_rate()
            price_eur = _native_to_eur(native_price, native_cur, eurusd)
            # price_usd: wenn native USD, direkt; sonst Annaeherung ueber EUR/USD
            price_usd = native_price if native_cur == "USD" else price_eur * eurusd

            return {
                "symbol":          symbol,
                "name":            name,
                "price_usd":       round(price_usd, 4),
                "price_eur":       round(price_eur, 4),
                "current_price":   round(price_eur, 4),   # Trades werden in EUR gespeichert
                "native_currency": native_cur,
                "logo_url":        logo_url,
                "asset_type":      "stock",
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"Aktie nicht gefunden: {e}")

    elif asset_type == "crypto":
        cg_id = coin_id or CRYPTO_ID_MAP.get(symbol, symbol.lower())
        try:
            resp = http_requests.get(
                f"https://api.coingecko.com/api/v3/coins/{cg_id}",
                params={
                    "localization":   "false",
                    "tickers":        "false",
                    "market_data":    "true",
                    "community_data": "false",
                    "developer_data": "false",
                },
                timeout=10,
            )
            if not resp.ok:
                raise HTTPException(status_code=404, detail=f"Krypto '{symbol}' nicht gefunden.")
            data        = resp.json()
            market_data = data.get("market_data", {}).get("current_price", {})
            price_eur   = float(market_data.get("eur", 0.0))
            price_usd   = float(market_data.get("usd", 0.0))

            return {
                "symbol":          symbol,
                "name":            data.get("name", symbol),
                "price_usd":       round(price_usd, 8),
                "price_eur":       round(price_eur, 8),
                "current_price":   round(price_eur, 8),
                "native_currency": "USD",
                "logo_url":        data.get("image", {}).get("small", ""),
                "asset_type":      "crypto",
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"Krypto nicht gefunden: {e}")

    raise HTTPException(status_code=400, detail="asset_type muss 'stock' oder 'crypto' sein.")


@router.post("/trades", response_model=Trade)
def create_trade(
    trade_in: TradeCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    trade = Trade(**trade_in.model_dump(), user_id=current_user.id)
    session.add(trade)
    session.commit()
    session.refresh(trade)
    return trade


@router.get("/trades", response_model=List[Trade])
def get_trades(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Trade).where(Trade.user_id == current_user.id).order_by(Trade.date.desc())
    return session.exec(stmt).all()


@router.delete("/trades/{trade_id}")
def delete_trade(
    trade_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    trade = session.exec(
        select(Trade).where(Trade.id == trade_id, Trade.user_id == current_user.id)
    ).first()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade nicht gefunden")
    session.delete(trade)
    session.commit()
    return {"status": "ok"}

# --- Update Schema für Trades ---
class TradeUpdate(BaseModel):
    quantity: float
    price_per_unit: float

@router.put("/trades/{trade_id}", response_model=Trade)
def update_trade(
    trade_id: int,
    trade_in: TradeUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # 1. Trade suchen und prüfen, ob er dem User gehört
    trade = session.exec(
        select(Trade).where(Trade.id == trade_id, Trade.user_id == current_user.id)
    ).first()

    if not trade:
        raise HTTPException(status_code=404, detail="Trade nicht gefunden")

    # 2. Werte aktualisieren
    trade.quantity = trade_in.quantity
    trade.price_per_unit = trade_in.price_per_unit

    # 3. Speichern
    session.add(trade)
    session.commit()
    session.refresh(trade)

    return trade


@router.get("/summary")
def get_portfolio_summary(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    trades = session.exec(select(Trade).where(Trade.user_id == current_user.id)).all()
    if not trades:
        return {
            "holdings":               [],
            "total_value":            0.0,
            "total_invested":         0.0,
            "total_unrealized_pnl":   0.0,
            "total_realized_pnl":     0.0,
            "total_realized_pnl_pct": 0.0,
            "total_pnl_pct":          0.0,
        }

    symbols_by_type = {t.symbol: t.asset_type for t in trades}
    return compute_portfolio_summary(trades, fetch_live_prices(symbols_by_type))


@router.get("/history")
def get_portfolio_history(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    import pandas as pd

    trades = session.exec(select(Trade).where(Trade.user_id == current_user.id)).all()
    if not trades:
        return []

    sorted_trades  = sorted(trades, key=lambda t: t.date)
    start_date     = sorted_trades[0].date
    symbols_by_type = {t.symbol: t.asset_type for t in trades}
    price_history  = fetch_price_history(symbols_by_type, start_date)

    today  = datetime.utcnow().date()
    result = []
    for current_dt in pd.date_range(start=_to_date(start_date), end=today, freq="D"):
        current_d = current_dt.date()
        date_str  = current_d.strftime("%Y-%m-%d")
        holdings  = compute_holdings_at(trades, up_to_date=current_d)
        if not holdings:
            continue
        portfolio_value = sum(
            qty * price_history.get(sym, {}).get(date_str, 0.0)
            for sym, qty in holdings.items()
        )
        if portfolio_value > 0:
            result.append({"date": date_str, "value": round(portfolio_value, 2)})

    return result


@router.get("/net-worth")
def get_net_worth_history(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    import pandas as pd
    from datetime import datetime

    # 1. Portfolio Historie berechnen
    trades = session.exec(select(Trade).where(Trade.user_id == current_user.id)).all()
    portfolio_history = {}
    if trades:
        sorted_trades = sorted(trades, key=lambda t: t.date)
        start_date = sorted_trades[0].date
        symbols_by_type = {t.symbol: t.asset_type for t in trades}
        price_history = fetch_price_history(symbols_by_type, start_date)

        today = datetime.utcnow().date()
        for current_dt in pd.date_range(start=_to_date(start_date), end=today, freq="D"):
            current_d = current_dt.date()
            date_str = current_d.strftime("%Y-%m-%d")
            holdings = compute_holdings_at(trades, up_to_date=current_d)
            val = sum(qty * price_history.get(sym, {}).get(date_str, 0.0) for sym, qty in holdings.items())
            portfolio_history[date_str] = val

    # 2. Fiat Historie berechnen
    fiat_tx = session.exec(select(Transaction).where(Transaction.user_id == current_user.id)).all()
    fiat_history = {}
    fiat_balance = 0.0
    if fiat_tx:
        sorted_fiat = sorted(fiat_tx, key=lambda t: t.date)
        fiat_start = _to_date(sorted_fiat[0].date)
        fiat_today = datetime.utcnow().date()

        tx_idx = 0
        for current_dt in pd.date_range(start=fiat_start, end=fiat_today, freq="D"):
            current_d = current_dt.date()
            date_str = current_d.strftime("%Y-%m-%d")

            # Alle Buchungen bis zu diesem Tag aufsummieren
            while tx_idx < len(sorted_fiat) and _to_date(sorted_fiat[tx_idx].date) <= current_d:
                fiat_balance += sorted_fiat[tx_idx].amount
                tx_idx += 1

            fiat_history[date_str] = fiat_balance

    # 3. Beide Zeitreihen zusammenführen
    all_dates = sorted(list(set(list(portfolio_history.keys()) + list(fiat_history.keys()))))
    result = []
    last_port = 0.0
    last_fiat = 0.0

    for d in all_dates:
        if d in portfolio_history:
            last_port = portfolio_history[d]
        if d in fiat_history:
            last_fiat = fiat_history[d]

        result.append({
            "date": d,
            "portfolio_value": round(last_port, 2),
            "fiat_value": round(last_fiat, 2),
            "total_value": round(last_port + last_fiat, 2)
        })

    return result