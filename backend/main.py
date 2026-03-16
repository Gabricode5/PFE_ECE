#déclares tes fonctions API (tes routes @app.post, @app.get, etc.).

from fastapi import FastAPI, HTTPException, Depends, status, APIRouter, File, UploadFile, Form, BackgroundTasks
from fastapi.responses import StreamingResponse
import requests
import json
import os
from langchain_ollama import OllamaEmbeddings
from langchain_postgres import PGVector
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import models, schemas
from database import engine, get_db
from datetime import datetime, timedelta
import json
import uuid
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()  # Charger les variables d'environnement depuis le fichier .env
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    from database import engine
    from sqlalchemy import text
    models.Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS name TEXT"
        ))
        conn.commit()
    yield

app = FastAPI(
    lifespan=lifespan,
    title="CRM Intelligent API",
    description="API pour un gestionnaire de tickets avec intégration IA",
    version="1.0.0", 
)

cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3005,http://localhost:3000").split(",")
    if origin.strip()
]
cors_origins = [
    origin if origin.startswith("http://") or origin.startswith("https://") else f"https://{origin}"
    for origin in cors_origins
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

auth_router = APIRouter(tags=["Auth"])
users_router = APIRouter(tags=["Users"])
chat_router = APIRouter(tags=["Chat"])
system_router = APIRouter(tags=["System"])


# Remplace ta ligne SECRET_KEY par celle-ci pour tester
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))
DATABASE_URL = os.getenv("DATABASE_URL")

# CONFIGURATION
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
RAG_COLLECTION = "rag_documents"

def _pg_connection_string() -> str:
    raw = os.getenv("DATABASE_URL", "postgresql://admin:Password1234@localhost:5432/ticketdb")
    return raw.replace("postgresql://", "postgresql+psycopg://", 1)

def sanitize_model_name(raw_value: str, fallback: str) -> str:
    normalized = (raw_value or "").replace(";", ",").strip()
    if not normalized:
        return fallback
    return normalized.split(",")[0].strip() or fallback

def chunk_text(text: str, size: int, overlap: int) -> list[str]:
    if size <= 0:
        return [text]
    step = max(1, size - max(0, overlap))
    return [text[i:i + size] for i in range(0, len(text), step)]

# Modèle de génération (si une liste est fournie par erreur, on garde le premier).
OLLAMA_MODEL = sanitize_model_name(os.getenv("OLLAMA_MODEL", "llama3.2:1b"), "llama3.2:1b")
# Modèle d'embedding dédié.
EMBED_MODEL = sanitize_model_name(os.getenv("EMBED_MODEL", "nomic-embed-text"), "nomic-embed-text")

# Initialisation de la fonction d'embedding (doit être la même que dans ingest.py)
embeddings = OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_URL)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)

# Stockage simple du statut d'ingestion (dev/local).
INGEST_JOBS: dict[str, dict] = {}

def create_access_token(data: dict):
    to_encode = data.copy()
    # Utilise datetime.now() au lieu de utcnow() pour tester
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    # Ajoute un print pour voir si ça bloque ici dans tes logs Docker
    print(f"DEBUG: Encoding token for {to_encode.get('sub')}") 
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme)
):
    """Fonction pour vérifier si le token est valide"""
    if not token:
        token = request.cookies.get("auth_token")
    if not token:
        raise HTTPException(status_code=401, detail="Session expirée ou invalide")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Token invalide")
        return email
    except JWTError:
        raise HTTPException(status_code=401, detail="Session expirée ou invalide")

def get_user_by_email(db: Session, email: str):
    return db.query(models.Utilisateur).filter(models.Utilisateur.email == email).first()

def is_admin_or_sav(user: models.Utilisateur | None):
    if not user or not user.role:
        return False
    return user.role.nom_role in ["admin", "sav"]


@system_router.get("/")
def read_root():
    return {"status": "Online", "message": "Le gestionnaire de tickets avec RAG est prêt"}

@auth_router.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # 1. Vérifier si l'email existe déjà
    existing_user = db.query(models.Utilisateur).filter(models.Utilisateur.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé.")

    # 2. Hacher le mot de passe
    hashed_password = pwd_context.hash(user.password)

    # Déterminer l'ID du rôle ("user" par défaut si 0 ou null)
    role_id = user.id_role
    if not role_id or role_id == 0:
        role_en_base = db.query(models.Role).filter(models.Role.nom_role == "user").first()
        role_id = role_en_base.id if role_en_base else 1

    # 3. Créer l'objet Utilisateur
    new_user = models.Utilisateur(
        username=user.username,
        email=user.email,
        password_hash=hashed_password,
        prenom=user.prenom,
        nom=user.nom,
        id_role=role_id
    )

    # 5. Sauvegarde
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    role_name = db.query(models.Role.nom_role).filter(models.Role.id == new_user.id_role).scalar() or "user"
    # 6. Retourner la réponse (doit correspondre à schemas.UserResponse)
    return {
        "id": new_user.id,
        "username": new_user.username,
        "email": new_user.email,
        "prenom": new_user.prenom,
        "nom": new_user.nom,
        "role": role_name, # On transforme l'ID en texte pour le front
        "date_creation": new_user.date_creation
    }

@auth_router.post("/login")
def login(user_credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    # 1. On cherche l'utilisateur avec une jointure pour charger le rôle
    user = db.query(models.Utilisateur).filter(models.Utilisateur.email == user_credentials.email).first()
    
    # 2. Vérification sécurité
    if not user or not pwd_context.verify(user_credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="L'email ou le mot de passe est incorrect"
        )

    # 3. Récupérer le nom du rôle (via la relation SQLAlchemy)
    # On suppose que dans ton fichier models.py, tu as une relation 'role' dans ta classe Utilisateur
    role_name = user.role.nom_role if user.role else "user"

    # 4. Générer le Token (On ajoute le rôle à l'intérieur du token pour plus de sécurité)
    access_token = create_access_token(data={
        "sub": user.email, 
        "user_id": user.id,
        "role": role_name # Optionnel mais recommandé
    })

    from fastapi.responses import JSONResponse
    response = JSONResponse(content={
        "access_token": access_token, 
        "token_type": "bearer",
        "username": user.username,
        "user_id": user.id,
        "nom_role": role_name # C'est cette valeur que ton frontend va utiliser
    })

    cookie_secure = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    response.set_cookie(
        key="auth_token",
        value=access_token,
        httponly=True,
        samesite="strict",
        secure=cookie_secure,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    return response

@app.post("/logout")
def logout():
    from fastapi.responses import JSONResponse
    response = JSONResponse(content={"message": "Déconnecté"})
    response.set_cookie(
        key="auth_token",
        value="",
        httponly=True,
        samesite="strict",
        secure=os.getenv("COOKIE_SECURE", "false").lower() == "true",
        max_age=0,
        path="/",
    )
    return response

@auth_router.get("/me", response_model=schemas.MeResponse)
def read_me(current_user: str = Depends(get_current_user), db: Session = Depends(get_db)):
    user = get_user_by_email(db, current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    role_name = user.role.nom_role if user.role else "user"
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "prenom": user.prenom,
        "nom": user.nom,
        "role": role_name,
        "date_creation": user.date_creation,
    }

@auth_router.put("/me", response_model=schemas.MeResponse)
def update_me(
    payload: schemas.MeUpdateRequest,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = get_user_by_email(db, current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    if payload.username is not None:
        new_username = payload.username.strip()
        if not new_username:
            raise HTTPException(status_code=400, detail="Le username ne peut pas être vide")
        existing_username = (
            db.query(models.Utilisateur)
            .filter(models.Utilisateur.username == new_username, models.Utilisateur.id != user.id)
            .first()
        )
        if existing_username:
            raise HTTPException(status_code=400, detail="Ce username est déjà utilisé")
        user.username = new_username

    if payload.email is not None:
        new_email = payload.email.strip().lower()
        existing_email = (
            db.query(models.Utilisateur)
            .filter(models.Utilisateur.email == new_email, models.Utilisateur.id != user.id)
            .first()
        )
        if existing_email:
            raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
        user.email = new_email

    if payload.prenom is not None:
        user.prenom = payload.prenom.strip() if payload.prenom else None

    if payload.nom is not None:
        user.nom = payload.nom.strip() if payload.nom else None

    db.commit()
    db.refresh(user)

    role_name = user.role.nom_role if user.role else "user"
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "prenom": user.prenom,
        "nom": user.nom,
        "role": role_name,
        "date_creation": user.date_creation,
    }

@auth_router.put("/me/password")
def update_my_password(
    payload: schemas.MePasswordUpdateRequest,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = get_user_by_email(db, current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    if not pwd_context.verify(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")

    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit contenir au moins 6 caractères")

    user.password_hash = pwd_context.hash(payload.new_password)
    db.commit()

    return {"message": "Mot de passe mis à jour"}

@chat_router.post("/sessions", response_model=schemas.ChatSessionResponse)
def create_session(session_data: schemas.ChatSessionCreate, user_id: int, db: Session = Depends(get_db)):
    # 1. Vérifier si l'utilisateur existe
    user = db.query(models.Utilisateur).filter(models.Utilisateur.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    requester = get_user_by_email(db, current_user)
    if not requester:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    if not is_admin_or_sav(requester) and requester.id != user_id:
        raise HTTPException(status_code=403, detail="Accès refusé")

    # 2. Créer la nouvelle session
    new_session = models.ChatSession(
        id_utilisateur=user_id,
        title=session_data.title
    )

    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    
    return new_session

@chat_router.get("/sessions", response_model=list[schemas.ChatSessionResponse])
def list_sessions(
    user_id: int,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Vérifier si l'utilisateur existe
    user = db.query(models.Utilisateur).filter(models.Utilisateur.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    requester = get_user_by_email(db, current_user)
    if not requester:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    if not is_admin_or_sav(requester) and requester.id != user_id:
        raise HTTPException(status_code=403, detail="Accès refusé")

    sessions = (
        db.query(models.ChatSession)
        .filter(models.ChatSession.id_utilisateur == user_id)
        .order_by(models.ChatSession.date_creation.desc())
        .all()
    )
    return sessions

@chat_router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée")

    requester = get_user_by_email(db, current_user)
    if not requester:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    if not is_admin_or_sav(requester) and session.id_utilisateur != requester.id:
        raise HTTPException(status_code=403, detail="Accès refusé")

    # Sécurité: supprime explicitement les messages si la cascade DB n'est pas active.
    db.query(models.ChatMessage).filter(models.ChatMessage.id_session == session_id).delete(synchronize_session=False)
    db.delete(session)
    db.commit()

    return

@users_router.get("/users", response_model=list[schemas.UserListResponse])
def list_users(
    role: str | None = None,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    requester = get_user_by_email(db, current_user)
    if not requester or not is_admin_or_sav(requester):
        raise HTTPException(status_code=403, detail="Accès refusé")

    query = db.query(models.Utilisateur).join(models.Role)
    if role:
        query = query.filter(models.Role.nom_role == role)

    users = query.all()
    return [
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "prenom": user.prenom,
            "nom": user.nom,
            "role": user.role.nom_role if user.role else "user"
        }
        for user in users
    ]

@users_router.put("/users/{user_id}/role", response_model=schemas.UserListResponse)
def update_user_role(
    user_id: int,
    payload: schemas.UserRoleUpdateRequest,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    requester = get_user_by_email(db, current_user)
    if not requester or not requester.role or requester.role.nom_role != "admin":
        raise HTTPException(status_code=403, detail="Accès refusé")

    target_user = db.query(models.Utilisateur).filter(models.Utilisateur.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    if requester.id == target_user.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas modifier votre propre rôle")

    new_role = payload.role.strip().lower()
    if new_role not in ["user", "sav", "admin"]:
        raise HTTPException(status_code=400, detail="Rôle invalide")

    role_row = db.query(models.Role).filter(models.Role.nom_role == new_role).first()
    if not role_row:
        raise HTTPException(status_code=400, detail="Rôle introuvable")

    target_user.id_role = role_row.id
    db.commit()
    db.refresh(target_user)

    return {
        "id": target_user.id,
        "username": target_user.username,
        "email": target_user.email,
        "prenom": target_user.prenom,
        "nom": target_user.nom,
        "role": target_user.role.nom_role if target_user.role else "user",
    }

@users_router.put("/users/{user_id}", response_model=schemas.UserListResponse)
def update_user_by_admin(
    user_id: int,
    payload: schemas.UserAdminUpdateRequest,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    requester = get_user_by_email(db, current_user)
    if not requester or not requester.role or requester.role.nom_role != "admin":
        raise HTTPException(status_code=403, detail="Accès refusé")

    target_user = db.query(models.Utilisateur).filter(models.Utilisateur.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    if payload.username is not None:
        new_username = payload.username.strip()
        if not new_username:
            raise HTTPException(status_code=400, detail="Le username ne peut pas être vide")
        existing_username = (
            db.query(models.Utilisateur)
            .filter(models.Utilisateur.username == new_username, models.Utilisateur.id != target_user.id)
            .first()
        )
        if existing_username:
            raise HTTPException(status_code=400, detail="Ce username est déjà utilisé")
        target_user.username = new_username

    if payload.email is not None:
        new_email = payload.email.strip().lower()
        existing_email = (
            db.query(models.Utilisateur)
            .filter(models.Utilisateur.email == new_email, models.Utilisateur.id != target_user.id)
            .first()
        )
        if existing_email:
            raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
        target_user.email = new_email

    if payload.prenom is not None:
        target_user.prenom = payload.prenom.strip() if payload.prenom else None

    if payload.nom is not None:
        target_user.nom = payload.nom.strip() if payload.nom else None

    if payload.role is not None:
        next_role = payload.role.strip().lower()
        if next_role not in ["user", "sav", "admin"]:
            raise HTTPException(status_code=400, detail="Rôle invalide")

        # Empêche un admin de se retirer son propre rôle admin par erreur.
        if requester.id == target_user.id and next_role != "admin":
            raise HTTPException(status_code=400, detail="Vous ne pouvez pas retirer votre rôle admin")

        role_row = db.query(models.Role).filter(models.Role.nom_role == next_role).first()
        if not role_row:
            raise HTTPException(status_code=400, detail="Rôle introuvable")
        target_user.id_role = role_row.id

    db.commit()
    db.refresh(target_user)

    return {
        "id": target_user.id,
        "username": target_user.username,
        "email": target_user.email,
        "prenom": target_user.prenom,
        "nom": target_user.nom,
        "role": target_user.role.nom_role if target_user.role else "user",
    }

@users_router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_by_admin(
    user_id: int,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    requester = get_user_by_email(db, current_user)
    if not requester or not requester.role or requester.role.nom_role != "admin":
        raise HTTPException(status_code=403, detail="Accès refusé")

    target_user = db.query(models.Utilisateur).filter(models.Utilisateur.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    if requester.id == target_user.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas supprimer votre propre compte")

    db.delete(target_user)
    db.commit()

    return

@chat_router.get("/messages", response_model=list[schemas.ChatMessageResponse])
def list_messages(session_id: int, current_user: str = Depends(get_current_user), db: Session = Depends(get_db)):
    user = get_user_by_email(db, current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée")

    if not is_admin_or_sav(user) and session.id_utilisateur != user.id:
        raise HTTPException(status_code=404, detail="Session non trouvée")

    messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.id_session == session_id)
        .order_by(models.ChatMessage.date_creation.asc())
        .all()
    )
    return messages

@chat_router.post("/messages", response_model=schemas.ChatMessageResponse, status_code=status.HTTP_201_CREATED)
def create_message(message: schemas.ChatMessageCreate, current_user: str = Depends(get_current_user), db: Session = Depends(get_db)):
    user = get_user_by_email(db, current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    session = db.query(models.ChatSession).filter(models.ChatSession.id == message.id_session).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée")

    if not is_admin_or_sav(user) and session.id_utilisateur != user.id:
        raise HTTPException(status_code=404, detail="Session non trouvée")

    if message.type_envoyeur not in ["user", "ai", "sav"]:
        raise HTTPException(status_code=400, detail="Type d'envoyeur invalide")

    new_message = models.ChatMessage(
        id_session=message.id_session,
        type_envoyeur=message.type_envoyeur,
        contenu=message.contenu
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    return new_message

#Route qui permet à ingest_postgres de recupérer la route dynamiquement via le front
@system_router.post("/knowledge-base/ingest-url", status_code=202)
def ingest_knowledge_base(
    payload: schemas.KnowledgeIngestRequest,
    background_tasks: BackgroundTasks,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    requester = get_user_by_email(db, current_user)
    if not requester or not is_admin_or_sav(requester):
        raise HTTPException(status_code=403, detail="Accès refusé")

    def run_ingest(url: str, category: str | None):
        try:
            from ingest_postgres import ingest_to_postgres
            from database import SessionLocal
            result = ingest_to_postgres(url=url, category=category)
            db2 = SessionLocal()
            try:
                from urllib.parse import urlparse
                parsed = urlparse(result["url"])
                auto_name = parsed.hostname or result["url"]
                source_record = models.KnowledgeSource(
                    name=auto_name,
                    source=result["url"],
                    source_type="url",
                    category=result["category"],
                    chunks=result["chunks"],
                    pages=None,
                )
                db2.add(source_record)
                db2.commit()
            except Exception:
                db2.rollback()
            finally:
                db2.close()
        except Exception as e:
            print(f"Erreur background ingest-url: {e}")

    background_tasks.add_task(run_ingest, str(payload.url), payload.category)
    return {"status": "started", "url": str(payload.url)}

@system_router.post("/knowledge-base/ingest-pdf", response_model=schemas.PdfIngestResponse)
async def ingest_pdf_endpoint(
    file: UploadFile = File(...),
    category: str = Form("pdf"),
    name: str = Form(""),
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    requester = get_user_by_email(db, current_user)
    if not requester or not is_admin_or_sav(requester):
        raise HTTPException(status_code=403, detail="Accès refusé")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Seuls les fichiers PDF sont acceptés")

    try:
        from ingest_pdf import ingest_pdf_to_postgres
        file_bytes = await file.read()
        result = ingest_pdf_to_postgres(file_bytes, file.filename, category)
        source_record = models.KnowledgeSource(
            name=name.strip() or file.filename,
            source=result["filename"],
            source_type="pdf",
            category=result["category"],
            chunks=result["chunks"],
            pages=result["pages"],
        )
        db.add(source_record)
        db.commit()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur ingestion PDF: {str(e)}")


@system_router.get("/knowledge-base/items", response_model=list[schemas.KnowledgeSourceResponse])
def list_knowledge_sources(
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    requester = get_user_by_email(db, current_user)
    if not requester or not is_admin_or_sav(requester):
        raise HTTPException(status_code=403, detail="Accès refusé")
    return (
        db.query(models.KnowledgeSource)
        .order_by(models.KnowledgeSource.date_creation.desc())
        .all()
    )


@system_router.delete("/knowledge-base/items/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_knowledge_source(
    source_id: int,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    requester = get_user_by_email(db, current_user)
    if not requester or not is_admin_or_sav(requester):
        raise HTTPException(status_code=403, detail="Accès refusé")

    ks = db.query(models.KnowledgeSource).filter(models.KnowledgeSource.id == source_id).first()
    if not ks:
        raise HTTPException(status_code=404, detail="Source introuvable")

    # Delete vectors from langchain_pg_embedding where metadata source matches.
    # The table only exists after the first ingestion, so we guard against that.
    from sqlalchemy import text
    try:
        db.execute(
            text("""
                DELETE FROM langchain_pg_embedding
                WHERE collection_id = (
                    SELECT uuid FROM langchain_pg_collection WHERE name = :collection
                )
                AND cmetadata->>'source' = :source
            """),
            {"collection": RAG_COLLECTION, "source": ks.source},
        )
    except Exception:
        db.rollback()  # table doesn't exist yet — nothing to delete, continue

    db.delete(ks)
    db.commit()


@system_router.get("/check-ai")
def check_ai():
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=REQUEST_TIMEOUT)
        return {"ollama_connected": True, "models": response.json()}
    except Exception as e:
        return {"ollama_connected": False, "error": str(e)}
    

@chat_router.post("/ask")
async def ask_question(
    question: str,
    session_id: int,
    mode: str = "rag_llm",
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # L'ajout de 'current_user' oblige l'utilisateur à être connecté
    user = get_user_by_email(db, current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée")

    if not is_admin_or_sav(user) and session.id_utilisateur != user.id:
        raise HTTPException(status_code=404, detail="Session non trouvée")

    user_message = models.ChatMessage(
        id_session=session_id,
        type_envoyeur="user",
        contenu=question
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    # --- RAG: retrieve context via langchain-postgres PGVector ---
    try:
        vector_store = PGVector(
            embeddings=embeddings,
            collection_name=RAG_COLLECTION,
            connection=_pg_connection_string(),
            use_jsonb=True,
        )
        relevant_docs = vector_store.similarity_search(question, k=4)
        context = "\n\n".join(doc.page_content for doc in relevant_docs)
    except Exception:
        relevant_docs = []
        context = ""

    print(f"[RAG] {len(relevant_docs)} docs retrieved for: {question!r}")
    for i, doc in enumerate(relevant_docs):
        preview = doc.page_content[:120].replace("\n", " ")
        src = doc.metadata.get("source", "?")
        print(f"  [{i+1}] ({src}) {preview}...")

    if context:
        rag_prompt = (
            f"Tu es un assistant de support client. Utilise uniquement le contexte ci-dessous pour répondre.\n\n"
            f"Contexte:\n{context}\n\n"
            f"Question de l'utilisateur: {question}"
            f"\n\n"
            f"*IMPORTANT* : if you don't have the answer, just say you don't know."
        )
    else:
        rag_prompt = f"Question de l'utilisateur: {question}"
    print(f"[RAG] Prompt: {rag_prompt}")
    ollama_payload = {
        "model": OLLAMA_MODEL,
        "prompt": rag_prompt,
        "stream": True,
    }

    def stream_and_save():
        tokens: list[str] = []
        try:
            with requests.post(
                f"{OLLAMA_URL}/api/generate",
                json=ollama_payload,
                stream=True,
                timeout=120,
            ) as resp:
                if not resp.ok:
                    yield f"[Erreur Ollama {resp.status_code}]"
                    return
                for raw_line in resp.iter_lines():
                    if not raw_line:
                        continue
                    try:
                        chunk = json.loads(raw_line)
                    except json.JSONDecodeError:
                        continue
                    token = chunk.get("response", "")
                    if token:
                        tokens.append(token)
                        yield token
                    if chunk.get("done"):
                        break
        finally:
            from database import SessionLocal
            db2 = SessionLocal()
            try:
                ai_message = models.ChatMessage(
                    id_session=session_id,
                    type_envoyeur="ai",
                    contenu="".join(tokens),
                )
                db2.add(ai_message)
                db2.commit()
            except Exception:
                db2.rollback()
            finally:
                db2.close()

    return StreamingResponse(stream_and_save(), media_type="text/plain")

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(chat_router)
app.include_router(system_router)
