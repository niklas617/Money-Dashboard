from __future__ import annotations
import os
from pathlib import Path
from sqlmodel import SQLModel, create_engine
from backend.app.core.settings import settings

# 1. Die URL holen (entweder aus settings oder direkt aus den Umgebungsvariablen als Fallback)
# Wir nutzen os.getenv als Sicherheitsnetz, falls settings.database_url leer ist
DATABASE_URL = settings.database_url or os.getenv("DATABASE_URL")

# --- DEBUG-HILFE FÜR RENDER (damit wir sehen, was los ist) ---
print("-----------------------------------------------------")
if not DATABASE_URL:
    print("❌ ALARM: DATABASE_URL ist leer! Bitte in Render Environment Variables prüfen.")
else:
    # Wir zeigen nur die ersten 10 Zeichen, damit das Passwort geheim bleibt
    print(f"✅ Lade Datenbank-URL: {DATABASE_URL[:10]}...")
print("-----------------------------------------------------")

# 2. Fix für Neon/Postgres (WICHTIG!)
# SQLAlchemy braucht 'postgresql://', aber Neon liefert oft 'postgres://'
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# 3. SQLite-Spezialbehandlung (nur für lokal)
if "sqlite" in str(DATABASE_URL):
    # Pfad korrigieren (dein alter Code)
    if DATABASE_URL.startswith("sqlite:///./"):
        base_dir = Path(__file__).resolve().parents[3]
        db_file = base_dir / DATABASE_URL.replace("sqlite:///./", "")
        DATABASE_URL = f"sqlite:///{db_file.as_posix()}"
    
    # SQLite braucht diesen Parameter
    connect_args = {"check_same_thread": False}
else:
    # PostgreSQL braucht diesen Parameter NICHT (das war der Fehler vorhin)
    connect_args = {}

# 4. Engine erstellen
# Wir fangen Fehler ab, falls die URL immer noch Quatsch ist
try:
    engine = create_engine(
        DATABASE_URL,
        echo=True,
        connect_args=connect_args
    )
except Exception as e:
    print(f"❌ Kritisches Problem beim Erstellen der Engine: {e}")
    raise e

def init_db() -> None:
    SQLModel.metadata.create_all(engine)