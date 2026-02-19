from fastapi import FastAPI

# Eigene Module importieren
from backend.app.core.settings import settings
from backend.app.db.database import init_db

# Router importieren
from backend.app.api.users import router as users_router
from backend.app.api.accounts import router as accounts_router
from backend.app.api.transactions import router as transactions_router
from backend.app.api.categories import router as categories_router
from backend.app.api.reports import router as reports_router 

# FastAPI App initialisieren
app = FastAPI(title=settings.app_name)

# Datenbank beim Start initialisieren
@app.on_event("startup")
def on_startup():
    init_db()

# --- Router einbinden ---
# Wir weisen jedem Router ein Präfix zu, z.B. beginnen alle Routen in users_router automatisch mit /users
# Das "tags"-Attribut sorgt dafür, dass die automatische API-Dokumentation (/docs) schön gruppiert wird.
app.include_router(users_router, prefix="/users", tags=["Users"])
app.include_router(accounts_router, prefix="/accounts", tags=["Accounts"])
app.include_router(transactions_router, prefix="/transactions", tags=["Transactions"])
app.include_router(categories_router, prefix="/categories", tags=["Categories"])
app.include_router(reports_router, prefix="/reports", tags=["Reports"])

# --- System-Endpunkte ---
@app.get("/health", tags=["System"])
def health():
    """Überprüft, ob der Server ordnungsgemäß läuft."""
    return {
        "status": "ok",
        "app": settings.app_name,
        "db": "connected",
    }