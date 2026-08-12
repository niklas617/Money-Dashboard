from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field

# --- 1. DATENBANK-TABELLEN (Das, was gespeichert wird) ---

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    email: Optional[str] = Field(default=None, unique=True)
    password_hash: str

class Account(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    currency: str
    # Anfangssaldo (Geld auf dem Konto, bevor Buchungen erfasst wurden).
    # Damit stimmt der echte Kontostand = opening_balance + Summe aller Buchungen –
    # konsistent in Web-App, Flutter-App UND der Netto-Vermögens-Übersicht.
    opening_balance: float = Field(default=0.0)
    # NEU: ondelete="CASCADE" hinzugefügt
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", ondelete="CASCADE")

class Category(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    # NEU: ondelete="CASCADE" hinzugefügt
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", ondelete="CASCADE")

class Transaction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    amount: float
    note: str
    date: datetime = Field(default_factory=datetime.utcnow)
    
    # NEU: ondelete="CASCADE" überall hinzugefügt (Löscht Buchungen, wenn Konto/Kategorie/User gelöscht wird)
    account_id: int = Field(foreign_key="account.id", ondelete="CASCADE")
    category_id: int = Field(foreign_key="category.id", ondelete="CASCADE")
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", ondelete="CASCADE")


# --- 2. EINGABE-MODELLE (Das, was das Frontend schickt) ---

class UserCreate(SQLModel):
    username: str
    password: str

class AccountCreate(SQLModel):
    name: str
    currency: str
    opening_balance: float = 0.0

class CategoryCreate(SQLModel):
    name: str

class TransactionCreate(SQLModel):
    amount: float
    note: str
    date: datetime = Field(default_factory=datetime.utcnow)
    account_id: int
    category_id: int


# --- PORTFOLIO ---

class Trade(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    symbol: str = Field(index=True)
    asset_name: str
    asset_type: str   # "stock" | "crypto"
    trade_type: str   # "BUY"  | "SELL"
    quantity: float
    price_per_unit: float
    # CoinGecko-Coin-ID (z. B. "bitcoin"). Nur fuer Krypto relevant – so wird der
    # Kurs unabhaengig von der hartkodierten Symbol-Map geladen (analog zum Aktien-Symbol).
    coin_id: Optional[str] = Field(default=None)
    date: datetime = Field(default_factory=datetime.utcnow)
    # NEU: ondelete="CASCADE" hinzugefügt
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", ondelete="CASCADE")


class TradeCreate(SQLModel):
    symbol: str
    asset_name: str
    asset_type: str
    trade_type: str
    quantity: float
    price_per_unit: float
    coin_id: Optional[str] = None
    date: datetime = Field(default_factory=datetime.utcnow)


# --- BUDGETS (monatliches Limit pro Kategorie) ---

class Budget(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    category_id: int = Field(foreign_key="category.id", ondelete="CASCADE")
    monthly_limit: float
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", ondelete="CASCADE")


class BudgetSet(SQLModel):
    monthly_limit: float


# --- KURS-ALERTS (serverseitige Liste; Feldnamen passen zur Flutter-App) ---

class PriceAlert(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    symbol: str
    asset_type: str   # "stock" | "crypto"
    target_price: float
    above: bool       # True = ueber Ziel benachrichtigen, False = unter
    enabled: bool = True
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", ondelete="CASCADE")


class PriceAlertCreate(SQLModel):
    symbol: str
    asset_type: str = "crypto"
    target_price: float
    above: bool = True

