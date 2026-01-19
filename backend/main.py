#déclares tes fonctions API (tes routes @app.post, @app.get, etc.).

from fastapi import FastAPI, HTTPException, Depends, status
import requests
import os
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import models
import schemas
from database import engine, get_db
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv

load_dotenv()  # Charger les variables d'environnement depuis le fichier .env

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI(
    title="CRM Intelligent API",
    description="API pour un gestionnaire de tickets avec intégration IA",
    version="1.0.0", 
)

# Récupération des URLs depuis le docker-compose
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def create_access_token(data: dict):
    to_encode = data.copy()
    # On définit l'heure d'expiration (ex: 60 minutes)
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    # On signe le jeton avec la clé secrète
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme)):
    """Fonction pour vérifier si le token est valide"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Token invalide")
        return email
    except JWTError:
        raise HTTPException(status_code=401, detail="Session expirée ou invalide")


@app.get("/")
def read_root():
    return {"status": "Online", "message": "Le gestionnaire de tickets est prêt"}

@app.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """
    Route pour inscrire un nouvel utilisateur.
    """
    # 1. Vérifier si l'email existe déjà dans la table 'utilisateur'
    existing_user = db.query(models.Utilisateur).filter(models.Utilisateur.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé.")

    # 2. Hacher le mot de passe (Sécurité obligatoire)
    hashed_password = pwd_context.hash(user.password)

    # 3. Créer l'objet Utilisateur (id_role = 1 pour 'user')
    new_user = models.Utilisateur(
        username=user.username,
        email=user.email,
        password_hash=hashed_password,
        prenom=user.prenom,
        nom=user.nom,
        id_role=1 
    )

    # 4. Ajouter et valider dans la base de données
    db.add(new_user)
    db.commit()
    db.refresh(new_user) # Récupère l'ID généré par Postgres

    return {
        "id": new_user.id,
        "username": new_user.username,
        "email": new_user.email,
        "prenom": new_user.prenom,
        "nom": new_user.nom,
        "role": user.role, # On reprend le texte "user" envoyé par le front
        "date_creation": new_user.date_creation
    }

@app.post("/login")
def login(user_credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    # 1. On cherche l'utilisateur dans la base par son email
    user = db.query(models.Utilisateur).filter(models.Utilisateur.email == user_credentials.email).first()
    
    # 2. Si l'utilisateur n'existe pas
    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="L'email ou le mot de passe est incorrect"
        )

    # 3. On compare le mot de passe reçu avec le hash stocké en base
    if not pwd_context.verify(user_credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="L'email ou le mot de passe est incorrect"
        )

    # 4. Si tout est bon, on génère le Token
    access_token = create_access_token(data={"sub": user.email, "user_id": user.id})

    # On renvoie le jeton au frontend
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "username": user.username
    }

@app.get("/check-ai")
def check_ai():
    """Vérifie si le backend peut parler à Ollama"""
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags")
        return {"ollama_connected": True, "models": response.json()}
    except Exception as e:
        return {"ollama_connected": False, "error": str(e)}

@app.post("/ask")
async def ask_question(question: str, current_user: str = Depends(get_current_user)):
    # L'ajout de 'current_user' oblige l'utilisateur à être connecté
    payload = {
        "model": "mistral-small",
        "prompt": f"Utilisateur {current_user} demande : {question}",
        "stream": False
    }
    response = requests.post(f"{OLLAMA_URL}/api/generate", json=payload)
    return response.json()