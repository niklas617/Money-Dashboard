from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
from backend.app.api import budgets
from backend.app.api import alerts

app = FastAPI(title=settings.app_name)

# --- CORS ---
# Das neue React-Web-Frontend laeuft im Browser und ruft die API cross-origin auf.
# Ohne CORS blockiert der Browser jeden Request. Da die Authentifizierung ueber
# Bearer-Token im Header laeuft (keine Cookies), ist allow_origins="*" mit
# allow_credentials=False sicher und ausreichend fuer ein persoenliches Dashboard.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
app.include_router(budgets.router, prefix="/budgets", tags=["Budgets"])
app.include_router(alerts.router, prefix="/alerts", tags=["Alerts"])

@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "db": "connected"}