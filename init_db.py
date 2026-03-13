from sqlmodel import SQLModel
from backend.app.db.database import engine
# WICHTIG: Wir müssen die Modelle importieren, damit SQLModel sie "registriert"
from backend.app.db import models 

def init():
    print("Erstelle Tabellen...")
    SQLModel.metadata.create_all(engine)
    print("✅ Fertig! Tabellen User, Account, Category, Transaction sollten jetzt da sein.")

if __name__ == "__main__":
    init()