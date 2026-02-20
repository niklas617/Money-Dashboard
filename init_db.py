# Datei: init_db.py
from sqlmodel import SQLModel
from backend.app.db.session import engine

# --- KORREKTUR: Der Pfad muss genau stimmen! ---
# Deine Datei liegt in: backend/app/db/models.py
# Also lautet der Import-Pfad: backend.app.db.models
try:
    from backend.app.db.models import Account, Transaction, Category
    print("✅ Modelle erfolgreich importiert!")
except ImportError as e:
    print(f"❌ Fehler beim Importieren: {e}")
    print("Tipp: Prüfe, ob im Ordner 'backend/app/db/' eine leere Datei '__init__.py' liegt.")
    exit()

def init_db():
    print("⏳ Verbinde mit Neon Cloud Datenbank...")
    
    # Erstelle die Tabellen
    SQLModel.metadata.create_all(engine)
    
    print("✅ ERFOLG! Tabellen (Account, Category, Transaction) wurden in der Cloud erstellt.")

if __name__ == "__main__":
    init_db()