from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field

# --- Users ---
class UserBase(SQLModel):
    name: str
    email: str

class User(UserBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

class UserCreate(UserBase):
    pass


# --- Accounts ---
class AccountBase(SQLModel):
    name: str
    currency: str = "EUR"

class Account(AccountBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

class AccountCreate(AccountBase):
    pass


# --- Categories ---
# Wichtig: Die Kategorie muss VOR der Transaktion definiert werden, 
# falls wir später echte Verknüpfungen (Foreign Keys) bauen wollen.
class Category(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str


# --- Transactions ---
# Hier ist jetzt alles zusammengefasst (nur noch EINMAL definiert)
class TransactionBase(SQLModel):
    account_id: int
    amount: float  # + Einnahme, - Ausgabe
    note: str = ""
    # Die category_id ist jetzt fest von Anfang an dabei!
    category_id: Optional[int] = Field(default=None, foreign_key="category.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Transaction(TransactionBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

class TransactionCreate(TransactionBase):
    pass