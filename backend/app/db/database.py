import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlmodel import SQLModel
from backend.app.core.settings import settings

# 1. URL holen
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = settings.database_url

# --- SICHERHEITS-REINIGUNG ---
if DATABASE_URL:
    DATABASE_URL = DATABASE_URL.strip('"').strip("'").strip()
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite Konfiguration
connect_args = {}
if DATABASE_URL and "sqlite" in DATABASE_URL:
    if DATABASE_URL.startswith("sqlite:///./"):
        base_dir = Path(__file__).resolve().parents[3]
        db_file = base_dir / DATABASE_URL.replace("sqlite:///./", "")
        DATABASE_URL = f"sqlite:///{db_file.as_posix()}"
    connect_args = {"check_same_thread": False}

# --- ENGINE KONFIGURATION (Postgres vs SQLite) ---
try:
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL ist leer!")

    # Standard-Argumente
    engine_args = {"echo": True}

    # Spezielle Einstellungen für PostgreSQL/Neon
    if "postgresql" in DATABASE_URL:
        engine_args.update({
            "pool_pre_ping": True,    # Prueft vor jeder Abfrage: "Ist die DB noch da?"
            "pool_recycle": 300,      # Verbindungen nach 5 Min refreshen
            "pool_size": 10,          # Verbindungen im Pool halten
            "max_overflow": 20,       # Erlaubt kurzzeitige Lastspitzen
            "connect_args": {"sslmode": "require"} # Erzwingt SSL-Verbindung
        })
    else:
        # SQLite Einstellungen
        engine_args["connect_args"] = connect_args

    engine = create_engine(DATABASE_URL, **engine_args)

except Exception as e:
    print(f"❌ FEHLER: Konnte Datenbank nicht verbinden.")
    raise e

def init_db() -> None:
    SQLModel.metadata.create_all(engine)