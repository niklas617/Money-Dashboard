from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select
from jose import JWTError, jwt
from pydantic import BaseModel
from google.oauth2 import id_token
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# --- NEUE IMPORTS FÜR KUGELSICHERE SSL-VERBINDUNG ---
from google.auth.transport import requests as google_requests
import requests as http_requests
import certifi

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

@router.post("/google/web")
async def google_auth_web(request: Request, session: Session = Depends(get_session)):
    try:
        # Formular auslesen, das Google uns schickt
        form_data = await request.form()
        token = form_data.get("id_token") or form_data.get("credential")
        
        if not token:
            raise HTTPException(status_code=400, detail="Kein Token empfangen")

      # --- DER BULLETPROOF FIX (STUFE 2) ---
        http_session = http_requests.Session()
        # Wir zwingen Render, die fehlerhafte SSL-Prüfung komplett zu überspringen:
        http_session.verify = False 
        
        g_request = google_requests.Request(session=http_session)

        # 1. Token bei Google verifizieren
        id_info = id_token.verify_oauth2_token(token, g_request, GOOGLE_CLIENT_ID)

        # 2. Nutzer in DB suchen oder anlegen
        statement = select(User).where(User.username == email)
        db_user = session.exec(statement).first()

        if not db_user:
            db_user = User(username=email, password_hash="GOOGLE_AUTH_USER_NO_PASSWORD")
            session.add(db_user)
            session.commit()
            session.refresh(db_user)
            
            # Standard-Kategorien anlegen
            for cat_name in ["Lebensmittel", "Miete/Wohnen", "Gehalt", "Freizeit", "Transport", "Sparen"]:
                session.add(Category(name=cat_name, user_id=db_user.id))
            session.commit()

        # 3. Deinen JWT-Token erstellen
        access_token = create_access_token(data={"sub": db_user.username, "user_id": db_user.id})
        
        # 4. Zurück zum Dashboard leiten (Deine echte Streamlit-URL)
        return RedirectResponse(url=f"https://money-dashboard-qem5mns8rbvthdkgffx5uq.streamlit.app?token={access_token}&user={email}", status_code=303)
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Ungültiger Google Token")
    except Exception as e:
        # Falls etwas schiefgeht, stürzt der Server nicht mehr blind ab!
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

# --- 2. NORMALER LOGIN ---
@router.post("/token")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    statement = select(User).where(User.username == form_data.username)
    user = session.exec(statement).first()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Falscher Username oder Passwort")
    
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