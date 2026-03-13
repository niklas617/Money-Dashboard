from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field

# --- 1. DATENBANK-TABELLEN (Das, was gespeichert wird) ---

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    password_hash: str

class Account(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    currency: str
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")

class Category(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")

class Transaction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    amount: float
    note: str
    date: datetime = Field(default_factory=datetime.utcnow)
    
    account_id: int = Field(foreign_key="account.id")
    category_id: int = Field(foreign_key="category.id")
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")


# --- 2. EINGABE-MODELLE (Das, was das Frontend schickt) ---
# Diese Klassen haben gefehlt!

class UserCreate(SQLModel):
    username: str
    password: str

class AccountCreate(SQLModel):
    name: str
    currency: str

class CategoryCreate(SQLModel):
    name: str

class TransactionCreate(SQLModel):
    amount: float
    note: str
    date: datetime = Field(default_factory=datetime.utcnow)
    account_id: int
    category_id: int