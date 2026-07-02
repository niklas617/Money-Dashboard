from fastapi import FastAPI
from backend.app.core.settings import settings
from backend.app.db.database import init_db
from backend.app.api import auth

# --- Router importieren ---
from backend.app.api import auth
from backend.app.api import accounts
from backend.app.api import categories
from backend.app.api import transactions
from backend.app.api import reports  # Erst aktivieren, wenn reports.py fertig ist
from backend.app.api import portfolio

app = FastAPI(title=settings.app_name)

@app.on_event("startup")
def on_startup():
    init_db()


# --- Router einbinden ---
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(accounts.router, prefix="/accounts", tags=["Accounts"])
app.include_router(categories.router, prefix="/categories", tags=["Categories"])
app.include_router(transactions.router, prefix="/transactions", tags=["Transactions"])
# app.include_router(reports.router, prefix="/reports", tags=["Reports"])
app.include_router(portfolio.router, prefix="/portfolio", tags=["Portfolio"])

@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "db": "connected"}