from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select
from jose import JWTError, jwt
from pydantic import BaseModel
import requests as http_requests

# Warnungen für das Ignorieren von SSL unterdrücken
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

from backend.app.db.database import engine
from backend.app.db.models import User, UserCreate, Category
from backend.app.core.security import get_password_hash, verify_password, create_access_token, SECRET_KEY, ALGORITHM

# 1. ROUTER INITIALISIEREN
router = APIRouter()

def get_session():
    with Session(engine) as session:
        yield session

# --- GOOGLE AUTHENTIFIZIERUNG (APP & WEB) ---
GOOGLE_CLIENT_ID = "8469072467-3bjur2tltvse1op2sslj5s0unpl0gmi4.apps.googleusercontent.com"

class GoogleAuthRequest(BaseModel):
    id_token: str
class UserUpdate(BaseModel):
    new_username: str

@router.post("/google/web")
async def google_auth_web(request: Request, session: Session = Depends(get_session)):
    try:
        # Formular auslesen, das Google uns schickt
        form_data = await request.form()
        token = form_data.get("id_token") or form_data.get("credential")
        
        if not token:
            raise HTTPException(status_code=400, detail="Kein Token empfangen")

        # --- DIE NUKLEAR-OPTION: Direkter API-Call zu Google ---
        # Wir umgehen die fehlerhafte Bibliothek komplett und fragen Google direkt.
        verify_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={token}"
        response = http_requests.get(verify_url, verify=False)
        
        if response.status_code != 200:
            raise ValueError("Ungültiger Google Token")
            
        id_info = response.json()
        
        # Sicherheits-Check: Ist der Token wirklich für unser Dashboard?
        if id_info.get("aud") != GOOGLE_CLIENT_ID:
            raise ValueError("Client-ID stimmt nicht überein")
            
        email = id_info.get("email")
        if not email:
            raise ValueError("Keine Email im Google-Token gefunden")

        # 2. Nutzer in DB suchen oder anlegen
        # Wir suchen nach der E-Mail ODER dem alten Benutzernamen (für Accounts, die vor diesem Update erstellt wurden)
        statement = select(User).where((User.email == email) | (User.username == email))
        db_user = session.exec(statement).first()

        if not db_user:
            # NEUER USER: Speichert die E-Mail ab jetzt fest in der neuen Spalte
            db_user = User(username=email, email=email, password_hash="GOOGLE_AUTH_USER_NO_PASSWORD")
            session.add(db_user)
            session.commit()
            session.refresh(db_user)
            
            # Standard-Kategorien anlegen
            for cat_name in ["Lebensmittel", "Miete/Wohnen", "Gehalt", "Freizeit", "Transport", "Sparen"]:
                session.add(Category(name=cat_name, user_id=db_user.id))
            session.commit()
        else:
            # MIGRATION: Wenn es ein alter Google-User ist, bei dem die E-Mail-Spalte noch leer ist, füllen wir sie jetzt leise im Hintergrund!
            if not db_user.email:
                db_user.email = email
                session.add(db_user)
                session.commit()

        # 3. Deinen JWT-Token erstellen
        access_token = create_access_token(data={"sub": db_user.username, "user_id": db_user.id})
        
        # 4. Zurück zum Dashboard leiten (Deine echte Streamlit-URL)
        return RedirectResponse(url=f"https://money-dashboard-qem5mns8rbvthdkgffx5uq.streamlit.app?token={access_token}&user={db_user.username}", status_code=303)

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backend-Fehler: {str(e)}")

# --- 1. NORMALE REGISTRIERUNG ---
@router.post("/register", response_model=User)
def register_user(user_input: UserCreate, session: Session = Depends(get_session)):
    statement = select(User).where(User.username == user_input.username)
    existing_user = session.exec(statement).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username bereits vergeben")
    
    hashed_pwd = get_password_hash(user_input.password)
    new_user = User(username=user_input.username, password_hash=hashed_pwd)
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    
    default_categories = ["Lebensmittel", "Miete/Wohnen", "Gehalt", "Freizeit", "Transport", "Sparen"]
    for cat_name in default_categories:
        cat = Category(name=cat_name, user_id=new_user.id)
        session.add(cat)
    session.commit()
    
    return new_user

# --- 2. NORMALER LOGIN (Mit E-Mail oder Benutzername) ---
@router.post("/token")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    
    # 1. Wir suchen den Nutzer entweder über seinen Namen ODER seine E-Mail
    statement = select(User).where(
        (User.username == form_data.username) | (User.email == form_data.username)
    )
    user = session.exec(statement).first()
    
    # 2. Prüfen, ob der Nutzer überhaupt existiert
    if not user:
        raise HTTPException(status_code=400, detail="Falscher Benutzername, E-Mail oder Passwort")
        
    # 3. Den "Google-Passwort"-Fehler abfangen
    if user.password_hash == "GOOGLE_AUTH_USER_NO_PASSWORD":
        raise HTTPException(
            status_code=400, 
            detail="Dieser Account wurde mit Google erstellt. Bitte nutze den Google-Login Button."
        )
        
    # 4. Echtes Passwort prüfen (für normale Registrierungen)
    if not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Falscher Benutzername, E-Mail oder Passwort")
    
    access_token = create_access_token(data={"sub": user.username, "user_id": user.id})
    return {"access_token": access_token, "token_type": "bearer"}

# --- 3. CURRENT USER (Sicherheitsüberprüfung) ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

def get_current_user(token: str = Depends(oauth2_scheme), session: Session = Depends(get_session)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    statement = select(User).where(User.username == username)
    user = session.exec(statement).first()
    if user is None:
        raise credentials_exception
    return user

    # --- 4. KONTO LÖSCHEN ---
@router.delete("/delete-account")
def delete_my_account(
    current_user: User = Depends(get_current_user), 
    session: Session = Depends(get_session)
):
    try:
        # Löscht den aktuell eingeloggten User aus der Datenbank
        session.delete(current_user)
        session.commit()
        return {"message": "Konto und alle zugehörigen Daten wurden gelöscht."}
    except Exception as e:
        session.rollback() # Macht den Vorgang rückgängig, falls etwas schiefgeht
        raise HTTPException(status_code=500, detail=f"Fehler beim Löschen des Kontos: {str(e)}")
    
    
# --- 5. BENUTZERNAMEN ÄNDERN ---
@router.put("/update-username")
def update_username(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    # 1. Prüfen, ob der neue Name schon von jemand anderem belegt ist
    statement = select(User).where(User.username == update_data.new_username)
    existing_user = session.exec(statement).first()
    
    if existing_user:
        raise HTTPException(status_code=400, detail="Dieser Benutzername ist bereits vergeben.")

    # 2. Namen in der Datenbank aktualisieren
    current_user.username = update_data.new_username
    session.add(current_user)
    session.commit()
    session.refresh(current_user)

    # 3. WICHTIG: Einen neuen Token ausstellen, da sich der Name (sub) geändert hat!
    new_token = create_access_token(data={"sub": current_user.username, "user_id": current_user.id})

    return {
        "message": "Name erfolgreich geändert", 
        "new_username": current_user.username,
        "new_token": new_token
    }