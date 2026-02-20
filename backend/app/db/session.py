import os
from sqlmodel import create_engine, Session, SQLModel
from dotenv import load_dotenv

# Lädt die .env Datei
load_dotenv()

# Holt die URL aus der .env Datei. 
# Falls keine da ist, nimmt er als Fallback wieder die lokale Datei (gut zum Testen)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///dashboard.db")

# Ein kleiner Fix, falls der Link mit "postgres://" anfängt (SQLAlchemy braucht "postgresql://")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Verbindung herstellen
engine = create_engine(DATABASE_URL, echo=True)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session