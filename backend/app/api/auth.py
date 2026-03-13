from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlmodel import Session, select
from jose import JWTError, jwt

from backend.app.db.database import engine
from backend.app.db.models import User, UserCreate, Category # Category importiert!
from backend.app.core.security import get_password_hash, verify_password, create_access_token, SECRET_KEY, ALGORITHM

router = APIRouter()

def get_session():
    with Session(engine) as session:
        yield session

# --- 1. REGISTRIERUNG (Jetzt mit Auto-Kategorien!) ---
@router.post("/register", response_model=User)
def register_user(user_input: UserCreate, session: Session = Depends(get_session)):
    # Check ob User existiert
    statement = select(User).where(User.username == user_input.username)
    existing_user = session.exec(statement).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username bereits vergeben")
    
    # User anlegen
    hashed_pwd = get_password_hash(user_input.password)
    new_user = User(username=user_input.username, password_hash=hashed_pwd)
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    
    # --- NEU: STANDARD KATEGORIEN AUTOMATISCH ANLEGEN ---
    default_categories = ["Lebensmittel", "Miete/Wohnen", "Gehalt", "Freizeit", "Transport", "Sparen"]
    
    for cat_name in default_categories:
        # Wir legen die Kategorie für den neuen User an
        cat = Category(name=cat_name, user_id=new_user.id)
        session.add(cat)
    
    session.commit() # Speichern
    # ----------------------------------------------------
    
    return new_user

# --- 2. LOGIN ---
@router.post("/token")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    statement = select(User).where(User.username == form_data.username)
    user = session.exec(statement).first()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Falscher Username oder Passwort")
    
    access_token = create_access_token(data={"sub": user.username, "user_id": user.id})
    return {"access_token": access_token, "token_type": "bearer"}

# --- 3. CURRENT USER ---
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