import os
from dotenv import load_dotenv  # <-- NEU
load_dotenv()
import json
import io
from typing import List
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlmodel import Session, select
from pydantic import BaseModel
from PIL import Image
import google.generativeai as genai

from backend.app.db.database import engine
# WICHTIG: Hier haben wir Category hinzugefügt!
from backend.app.db.models import Transaction, TransactionCreate, User, Category
from backend.app.api.auth import get_current_user

# --- GEMINI SETUP ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# WICHTIG: In einer Unter-Datei nutzen wir APIRouter, nicht FastAPI!
router = APIRouter()


# --- Hilfsfunktion für die Datenbank-Session ---
def get_session():
    with Session(engine) as session:
        yield session


# --- Schema für Updates (Model) ---
class TransactionUpdate(BaseModel):
    amount: float
    note: str
    category_id: int
    account_id: int
    date: date


# ==========================================
# ROUTEN
# ==========================================

@router.post("/", response_model=Transaction)
def create_transaction(
    tx: TransactionCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    new_tx = Transaction.from_orm(tx)
    new_tx.user_id = current_user.id
    session.add(new_tx)
    session.commit()
    session.refresh(new_tx)
    return new_tx


@router.get("/filter", response_model=List[Transaction])
def filter_transactions(
    account_id: int,
    year: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # Zeige nur Buchungen für mein Konto UND meinen User
    statement = select(Transaction).where(
        Transaction.account_id == account_id, Transaction.user_id == current_user.id
    )
    return session.exec(statement).all()


@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # 1. Die Transaktion suchen
    statement = select(Transaction).where(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id,
    )
    tx = session.exec(statement).first()

    # 2. Prüfen
    if not tx:
        raise HTTPException(status_code=404, detail="Transaktion nicht gefunden")

    # 3. Löschen
    session.delete(tx)
    session.commit()

    return {"status": "ok", "message": "Gelöscht"}


# --- DER PUT ENDPUNKT (Bearbeiten) ---
@router.put("/{transaction_id}", response_model=Transaction)
def update_transaction(
    transaction_id: int,
    transaction_data: TransactionUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # 1. Suchen (SQLModel Style)
    statement = select(Transaction).where(Transaction.id == transaction_id)
    db_tx = session.exec(statement).first()

    if not db_tx:
        raise HTTPException(status_code=404, detail="Buchung nicht gefunden")

    # Sicherheit: Gehört die Buchung mir?
    if db_tx.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Nicht erlaubt (Falscher User)")

    # 2. Werte aktualisieren
    db_tx.amount = transaction_data.amount
    db_tx.note = transaction_data.note
    db_tx.category_id = transaction_data.category_id
    db_tx.account_id = transaction_data.account_id
    db_tx.date = transaction_data.date

    # 3. Speichern
    session.add(db_tx)
    session.commit()
    session.refresh(db_tx)

    return db_tx


# ==========================================
# NEU: KI SCANNER ENDPUNKT
# ==========================================
@router.post("/scan")
async def scan_bank_statement(
    account_id: int = Form(...),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # 1. Sicherheits-Check
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API Key ist nicht konfiguriert.")

    try:
        # 2. Bilddaten einlesen und für Gemini vorbereiten
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data))

        # 3. Kategorien des Users aus der Datenbank laden
        user_categories = session.exec(
            select(Category).where(Category.user_id == current_user.id)
        ).all()
        
        cat_names = [c.name for c in user_categories]
        cat_map = {c.name: c.id for c in user_categories}
        fallback_cat_id = user_categories[0].id if user_categories else None

        # 4. Der System-Prompt
        prompt = f"""
        Du bist ein extrem präziser Finanz-Assistent für die Datenextraktion.
        Analysiere dieses Bild eines Kontoauszugs oder einer Banking-App.
        Finde alle Transaktionen (Einnahmen und Ausgaben) und gib sie exakt als JSON-Array zurück.
        
        Format-Vorlage für jeden Eintrag im Array:
        {{
            "date": "YYYY-MM-DD",
            "amount": 12.34,
            "note": "Name des Geschäfts, Verwendungszweck oder Sender/Empfänger",
            "category": "Wähle die am besten passende Kategorie aus dieser exakten Liste: {', '.join(cat_names)}. Wenn keine passt, wähle die ähnlichste."
        }}
        
        WICHTIGE REGELN:
        - Ausgaben MÜSSEN zwingend negative Zahlen sein (z.B. -15.99).
        - Einnahmen sind positive Zahlen.
        - Antworte AUSSCHLIESSLICH mit dem validen JSON-Array. Keine Einleitung, kein Markdown, keine Code-Blöcke (kein ```json). Nur das reine Array.
        """

        # 5. Anfrage an das Gemini 1.5 Flash Modell senden
        model = genai.GenerativeModel('gemini-flash-latest')
        response = model.generate_content([prompt, image])

        # 6. Antwort bereinigen
        response_text = response.text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:-3].strip()
        elif response_text.startswith("```"):
            response_text = response_text[3:-3].strip()

        # JSON in eine Python-Liste umwandeln
        transactions_data = json.loads(response_text)

        # 7. Die ausgelesenen Daten in die Datenbank schreiben
        saved_count = 0
        for t_data in transactions_data:
            cat_name = t_data.get("category")
            cat_id = cat_map.get(cat_name, fallback_cat_id)

            new_tx = Transaction(
                amount=float(t_data["amount"]),
                note=t_data.get("note", "KI Scan"),
                date=t_data["date"],
                account_id=account_id,
                category_id=cat_id,
                user_id=current_user.id
            )
            session.add(new_tx)
            saved_count += 1
            
        session.commit()

        return {"status": "success", "count": saved_count}

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="KI hat kein gültiges Format zurückgegeben.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler bei der Verarbeitung: {str(e)}")