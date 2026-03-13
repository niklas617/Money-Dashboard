import bcrypt
from datetime import datetime, timedelta
from jose import jwt
import os
from backend.app.core.settings import settings

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Prüft, ob das Passwort zum Hash passt.
    Wichtig: bcrypt braucht 'bytes' (b"..."), keine normalen Strings.
    """
    # Wir wandeln alles in Bytes um, damit bcrypt arbeiten kann
    password_byte_enc = plain_password.encode('utf-8')
    hashed_password_byte_enc = hashed_password.encode('utf-8')
    
    return bcrypt.checkpw(password_byte_enc, hashed_password_byte_enc)

def get_password_hash(password: str) -> str:
    """
    Erstellt einen sicheren Hash aus dem Passwort.
    """
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_bytes = bcrypt.hashpw(pwd_bytes, salt)
    
    # Wir speichern es als String in der Datenbank (decode)
    return hashed_bytes.decode('utf-8')

# --- KONFIGURATION (Laden aus .env oder Fallback) ---
SECRET_KEY = settings.secret_key or os.getenv("SECRET_KEY", "fallback_secret_key_123")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# --- NEUE FUNKTION: TOKEN ERSTELLEN ---
def create_access_token(data: dict):
    to_encode = data.copy()
    
    # Wann läuft das Bändchen ab? (Jetzt + 30 Minuten)
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    # Token unterschreiben (mit deinem geheimen Schlüssel)
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt