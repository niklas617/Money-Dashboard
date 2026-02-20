from __future__ import annotations
import os
from pathlib import Path
from sqlmodel import SQLModel, create_engine
from backend.app.core.settings import settings

# 1. URL holen (Priorität: Render Umgebungsvariable > Settings > SQLite Fallback)
DATABASE_URL = os.getenv("DATABASE_URL")

# Falls keine Render-Variable da ist, nimm die aus den Settings (für lokal)
if not DATABASE_URL:
    DATABASE_URL = settings.database_url

# --- SICHERHEITS-REINIGUNG (Das fixt den Render-Fehler!) ---
if DATABASE_URL:
    # Entfernt versehentliche Anführungszeichen ( " oder ' ) am Anfang/Ende
    DATABASE_URL = DATABASE_URL.strip('"').strip("'")
    # Entfernt Leerzeichen
    DATABASE_URL = DATABASE_URL.strip()
    
    # Fix für Neon (postgres -> postgresql)
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# --- DEBUGGING (Damit wir im Log sehen, was passiert) ---
print(f"🔧 DB-Check: URL-Länge ist {len(str(DATABASE_URL)) if DATABASE_URL else 0}")
if DATABASE_URL and "postgresql" in DATABASE_URL:
    print("✅ Erkenne PostgreSQL URL")
# -------------------------------------------------------

# SQLite Konfiguration (Lokal)
connect_args = {}
if DATABASE_URL and "sqlite" in DATABASE_URL:
    if DATABASE_URL.startswith("sqlite:///./"):
        base_dir = Path(__file__).resolve().parents[3]
        db_file = base_dir / DATABASE_URL.replace("sqlite:///./", "")
        DATABASE_URL = f"sqlite:///{db_file.as_posix()}"
    connect_args = {"check_same_thread": False}

# Engine erstellen
try:
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL ist leer!")
        
    engine = create_engine(
        DATABASE_URL,
        echo=True,
        connect_args=connect_args
    )
except Exception as e:
    print(f"❌ FEHLER: Konnte Datenbank nicht verbinden. URL Start: {str(DATABASE_URL)[:10]}...")
    raise e

def init_db() -> None:
    SQLModel.metadata.create_all(engine)