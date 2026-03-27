#déclares tes fonctions API (tes routes @app.post, @app.get, etc.).

from fastapi import FastAPI, HTTPException, Depends, status, Request, BackgroundTasks, UploadFile, File, Form
from fastapi.responses import StreamingResponse
import os
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import models, schemas
from database import get_db
from datetime import datetime, timedelta
import uuid
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from mistral_client import embed_text, generate_text, stream_text

load_dotenv()  # Charger les variables d'environnement depuis le fichier .env
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("main")

app = FastAPI(
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

# Remplace ta ligne SECRET_KEY par celle-ci pour tester
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

# CONFIGURATION
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "10"))
KB_TOP_K = int(os.getenv("KB_TOP_K", "10"))
KB_MAX_CONTEXT_CHARS = int(os.getenv("KB_MAX_CONTEXT_CHARS", "3000"))
SUMMARY_MAX_CHARS = int(os.getenv("SUMMARY_MAX_CHARS", "4000"))
SUMMARY_MAX_MESSAGES = int(os.getenv("SUMMARY_MAX_MESSAGES", "50"))
TRANSCRIPT_MAX_CHARS = int(os.getenv("TRANSCRIPT_MAX_CHARS", "12000"))
TRANSCRIPT_CHUNK_SIZE = int(os.getenv("TRANSCRIPT_CHUNK_SIZE", "1000"))
TRANSCRIPT_CHUNK_OVERLAP = int(os.getenv("TRANSCRIPT_CHUNK_OVERLAP", "150"))

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY manquante. Définis-la dans l'environnement.")

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


def sanitize_text(value: str) -> str:
    return value.replace("\x00", "").strip()


def build_rag_prompt(question: str, context: str) -> str:
    return f"""
Tu es un assistant SAV. Réponds clairement et de façon professionnelle.
Si le contexte n'apporte pas la réponse, dis-le honnêtement.
Réponds en texte brut uniquement, sans markdown, sans listes en syntaxe markdown et sans liens au format [texte](url).

CONTEXTE (base de connaissances) :
{context or "Aucun contexte disponible."}

QUESTION :
{question}
""".strip()

# Modèle de génération (si une liste est fournie par erreur, on garde le premier).
MISTRAL_MODEL = sanitize_model_name(os.getenv("MISTRAL_MODEL", "mistral-small-latest"), "mistral-small-latest")
# Modèle d'embedding dédié.
EMBED_MODEL = sanitize_model_name(os.getenv("EMBED_MODEL", "mistral-embed"), "mistral-embed")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)

# Stockage simple du statut d'ingestion (dev/local).
INGEST_JOBS: dict[str, dict] = {}

from database import engine as _engine
from sqlalchemy import text as _text

@app.on_event("startup")
def run_migrations():
    with _engine.connect() as conn:
        conn.execute(_text(
            "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS feedback INTEGER"
        ))
        conn.execute(_text(
            "ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS transfer_reason VARCHAR(50)"
        ))
        conn.commit()

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


@app.get("/")
def read_root():
    return {"status": "Online", "message": "Le gestionnaire de tickets avec RAG est prêt"}

@app.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # 1. Vérifier si l'email existe déjà
    existing_user = db.query(models.Utilisateur).filter(models.Utilisateur.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé.")

    # 2. Hacher le mot de passe
    hashed_password = pwd_context.hash(user.password)

    # 3. Forcer un role serveur (pas depuis le client)
    default_role = db.query(models.Role).filter(models.Role.nom_role == "user").first()
    if not default_role:
        raise HTTPException(status_code=500, detail="Rôle par défaut introuvable")

    # 4. Créer l'objet Utilisateur
    new_user = models.Utilisateur(
        username=user.username,
        email=user.email,
        password_hash=hashed_password,
        prenom=user.prenom,
        nom=user.nom,
        id_role=default_role.id,
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

@app.post("/login")
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

@app.get("/me", response_model=schemas.MeResponse)
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

@app.put("/me", response_model=schemas.MeResponse)
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

@app.put("/me/password")
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

@app.post("/sessions", response_model=schemas.ChatSessionResponse)
def create_session(
    session_data: schemas.ChatSessionCreate,
    user_id: int,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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

@app.get("/sessions", response_model=list[schemas.ChatSessionResponse])
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

@app.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: int,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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

@app.post("/sessions/{session_id}/close", response_model=schemas.ChatSessionResponse)
def close_session(
    session_id: int,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée")

    requester = get_user_by_email(db, current_user)
    if not requester:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    if not is_admin_or_sav(requester) and session.id_utilisateur != requester.id:
        raise HTTPException(status_code=403, detail="Accès refusé")

    if getattr(session, "status", "open") == "closed":
        return session

    messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.id_session == session_id)
        .order_by(models.ChatMessage.date_creation.asc())
        .limit(SUMMARY_MAX_MESSAGES)
        .all()
    )

    transcript_parts = []
    for msg in messages:
        if not msg.contenu:
            continue
        transcript_parts.append(sanitize_text(f"{msg.type_envoyeur.upper()}: {msg.contenu}"))
    transcript = "\n".join(transcript_parts)
    transcript = transcript[:TRANSCRIPT_MAX_CHARS]

    if not transcript:
        summary_text = "Ticket clos sans message."
    else:
        summary_prompt = f"""
Tu es un agent SAV. Résume ce ticket en 5 à 8 lignes maximum.
Inclue: problème principal, actions tentées, solution finale (si connue).

TRANSCRIPT:
{transcript[:SUMMARY_MAX_CHARS]}
""".strip()
        summary_text = ""
        try:
            summary_text = sanitize_text(generate_text(
                summary_prompt,
                model=MISTRAL_MODEL,
                timeout=REQUEST_TIMEOUT,
            ))
        except Exception as e:
            print(f"DEBUG: summary error -> {e}")

        if not summary_text:
            first = transcript_parts[0] if transcript_parts else ""
            last = transcript_parts[-1] if transcript_parts else ""
            summary_text = sanitize_text("Résumé court du ticket:\n" + "\n".join([p for p in [first, last] if p]))

    # Indexation du résumé dans la base de connaissances
    try:
        summary_text = sanitize_text(summary_text)
        summary_embedding = embed_text(summary_text, model=EMBED_MODEL, timeout=REQUEST_TIMEOUT)
        kb_row = models.KnowledgeBase(
            source_message_id=None,
            contenu=f"Résumé session #{session_id} (user_id={session.id_utilisateur})\n{summary_text}",
            embedding=summary_embedding,
            category="ticket_summary",
        )
        db.add(kb_row)
    except Exception as e:
        print(f"DEBUG: KB insert error -> {e}")

    # Indexation du transcript complet (chunké) pour un RAG plus précis
    if transcript:
        try:
            chunks = chunk_text(transcript, TRANSCRIPT_CHUNK_SIZE, TRANSCRIPT_CHUNK_OVERLAP)
            total = len(chunks)
            for idx, chunk in enumerate(chunks, start=1):
                chunk = sanitize_text(chunk)
                if not chunk:
                    continue
                vector = embed_text(chunk, model=EMBED_MODEL, timeout=REQUEST_TIMEOUT)
                kb_row = models.KnowledgeBase(
                    source_message_id=None,
                    contenu=f"Transcript session #{session_id} (user_id={session.id_utilisateur}) [{idx}/{total}]\n{chunk}",
                    embedding=vector,
                    category="ticket_transcript",
                )
                db.add(kb_row)
        except Exception as e:
            print(f"DEBUG: KB transcript insert error -> {e}")

    session.status = "closed"
    db.commit()
    db.refresh(session)
    return session

@app.get("/users", response_model=list[schemas.UserListResponse])
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

@app.put("/users/{user_id}/role", response_model=schemas.UserListResponse)
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

@app.put("/users/{user_id}", response_model=schemas.UserListResponse)
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

@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
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

@app.get("/messages", response_model=list[schemas.ChatMessageResponse])
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

@app.post("/messages", response_model=schemas.ChatMessageResponse, status_code=status.HTTP_201_CREATED)
def create_message(message: schemas.ChatMessageCreate, current_user: str = Depends(get_current_user), db: Session = Depends(get_db)):
    user = get_user_by_email(db, current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    session = db.query(models.ChatSession).filter(models.ChatSession.id == message.id_session).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée")

    if not is_admin_or_sav(user) and session.id_utilisateur != user.id:
        raise HTTPException(status_code=404, detail="Session non trouvée")

    if getattr(session, "status", "open") == "closed":
        raise HTTPException(status_code=400, detail="Cette conversation est clôturée.")

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
@app.post("/knowledge-base/ingest-url", response_model=schemas.KnowledgeIngestResponse)
def ingest_knowledge_base(
    payload: schemas.KnowledgeIngestRequest,
    background_tasks: BackgroundTasks,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    requester = get_user_by_email(db, current_user)
    if not requester or not is_admin_or_sav(requester):
        raise HTTPException(status_code=403, detail="Accès refusé")

    try:
        from ingest_postgres import ingest_to_postgres
        # Lance l'ingestion en arrière-plan pour éviter les timeouts proxy.
        job_id = str(uuid.uuid4())
        INGEST_JOBS[job_id] = {
            "status": "running",
            "started_at": datetime.utcnow().isoformat(),
            "url": str(payload.url),
            "category": payload.category or "",
            "result": None,
            "error": None,
        }

        def _run_ingest(job_id_value: str, url_value: str, category_value: str | None):
            logger.info("[ingest-url] job=%s url=%s category=%s — starting", job_id_value, url_value, category_value)
            try:
                result = ingest_to_postgres(url=url_value, category=category_value)
                INGEST_JOBS[job_id_value]["status"] = "completed"
                INGEST_JOBS[job_id_value]["result"] = result
                logger.info("[ingest-url] job=%s — completed: %s chunks inserted", job_id_value, result.get("inserted"))
            except Exception as e:
                INGEST_JOBS[job_id_value]["status"] = "failed"
                INGEST_JOBS[job_id_value]["error"] = str(e)
                logger.error("[ingest-url] job=%s — failed: %s", job_id_value, e)
            finally:
                INGEST_JOBS[job_id_value]["finished_at"] = datetime.utcnow().isoformat()

        background_tasks.add_task(_run_ingest, job_id, str(payload.url), payload.category)
        return {
            "status": "started",
            "message": "Indexation lancée en arrière-plan. Cela peut prendre quelques minutes.",
            "url": str(payload.url),
            "category": payload.category or "",
            "job_id": job_id,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur ingestion: {str(e)}")


@app.get("/knowledge-base/ingest-status")
def ingest_status(
    job_id: str,
    current_user: str = Depends(get_current_user),
):
    if job_id not in INGEST_JOBS:
        raise HTTPException(status_code=404, detail="Job introuvable")
    return INGEST_JOBS[job_id]


@app.get("/knowledge-base/sources")
def get_knowledge_sources(
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from sqlalchemy import func as sqlfunc
    rows = (
        db.query(
            models.KnowledgeBase.source,
            models.KnowledgeBase.category,
            sqlfunc.count(models.KnowledgeBase.id).label("chunks"),
            sqlfunc.min(models.KnowledgeBase.date_creation).label("date_creation"),
        )
        .filter(models.KnowledgeBase.source.isnot(None))
        .group_by(models.KnowledgeBase.source, models.KnowledgeBase.category)
        .order_by(sqlfunc.min(models.KnowledgeBase.date_creation).desc())
        .all()
    )
    return [
        {
            "source": r.source,
            "category": r.category,
            "chunks": r.chunks,
            "date_creation": r.date_creation.isoformat() if r.date_creation else None,
        }
        for r in rows
    ]


@app.delete("/knowledge-base/sources")
def delete_knowledge_source(
    source: str,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    requester = get_user_by_email(db, current_user)
    if not requester or not is_admin_or_sav(requester):
        raise HTTPException(status_code=403, detail="Accès refusé")
    deleted = db.query(models.KnowledgeBase).filter(models.KnowledgeBase.source == source).delete()
    db.commit()
    logger.info("[delete-source] user=%s deleted source='%s' (%d rows)", current_user, source, deleted)
    return {"deleted": deleted, "source": source}


@app.post("/knowledge-base/ingest-file", response_model=schemas.KnowledgeIngestResponse)
async def ingest_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    category: str = Form(None),
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    requester = get_user_by_email(db, current_user)
    if not requester or not is_admin_or_sav(requester):
        raise HTTPException(status_code=403, detail="Accès refusé")

    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    logger.info("[ingest-file] request received: file=%s ext=%s category=%s user=%s", filename, ext, category, current_user)
    if ext not in ("txt", "docx", "pdf"):
        logger.warning("[ingest-file] rejected file=%s (unsupported extension)", filename)
        raise HTTPException(status_code=400, detail="Seuls les fichiers .pdf, .txt et .docx sont acceptés.")

    file_bytes = await file.read()

    from ingest_postgres import ingest_file_to_postgres
    job_id = str(uuid.uuid4())
    INGEST_JOBS[job_id] = {
        "status": "running",
        "started_at": datetime.utcnow().isoformat(),
        "filename": filename,
        "category": category or "",
        "result": None,
        "error": None,
    }

    def _run(job_id_value: str, bytes_value: bytes, name: str, cat: str | None):
        logger.info("[ingest-file] job=%s file=%s size=%d bytes category=%s — starting", job_id_value, name, len(bytes_value), cat)
        try:
            result = ingest_file_to_postgres(bytes_value, name, cat)
            INGEST_JOBS[job_id_value]["status"] = "completed"
            INGEST_JOBS[job_id_value]["result"] = result
            logger.info("[ingest-file] job=%s file=%s — completed: %s chunks inserted", job_id_value, name, result.get("inserted"))
        except Exception as e:
            INGEST_JOBS[job_id_value]["status"] = "failed"
            INGEST_JOBS[job_id_value]["error"] = str(e)
            logger.error("[ingest-file] job=%s file=%s — failed: %s", job_id_value, name, e)
        finally:
            INGEST_JOBS[job_id_value]["finished_at"] = datetime.utcnow().isoformat()

    background_tasks.add_task(_run, job_id, file_bytes, filename, category)
    return {
        "status": "started",
        "message": f"Indexation de '{filename}' lancée en arrière-plan.",
        "job_id": job_id,
    }


@app.post("/ask/stream")
def ask_question_stream(
    payload: schemas.AskRequest,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    question = payload.question
    session_id = payload.session_id
    mode = payload.mode
    user = get_user_by_email(db, current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée")

    if not is_admin_or_sav(user) and session.id_utilisateur != user.id:
        raise HTTPException(status_code=404, detail="Session non trouvée")

    if getattr(session, "status", "open") == "closed":
        raise HTTPException(status_code=400, detail="Cette conversation est clôturée.")

    user_message = models.ChatMessage(
        id_session=session_id,
        type_envoyeur="user",
        contenu=question
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    # Auto-titre: si la session n'a pas de titre, on utilise la 1ère question.
    if not session.title or not session.title.strip() or session.title.strip().lower() == "nouvelle conversation":
        auto_title = question.strip().replace("\n", " ")
        if auto_title:
            session.title = auto_title[:80]
            db.commit()

    # Récupération de contexte depuis la base de connaissances (RAG)
    context = ""
    try:
        query_embedding = embed_text(question, model=EMBED_MODEL, timeout=REQUEST_TIMEOUT)
        kb_rows = (
            db.query(models.KnowledgeBase)
            .order_by(models.KnowledgeBase.embedding.cosine_distance(query_embedding))
            .limit(KB_TOP_K)
            .all()
        )
        if kb_rows:
            context = "\n\n".join(row.contenu for row in kb_rows if row.contenu)
            context = context[:KB_MAX_CONTEXT_CHARS]
    except Exception as e:
        print(f"DEBUG: RAG context error -> {e}")
        db.rollback()

    prompt = build_rag_prompt(question, context)

    if mode == "rag_only":
        ai_text = context or "Aucun contexte disponible."
        ai_message = models.ChatMessage(
            id_session=session_id,
            type_envoyeur="ai",
            contenu=ai_text
        )
        db.add(ai_message)
        db.commit()
        db.refresh(ai_message)
        return StreamingResponse(iter([ai_text]), media_type="text/plain")

    def stream_tokens():
        ai_chunks: list[str] = []
        try:
            for token in stream_text(prompt, model=MISTRAL_MODEL, timeout=REQUEST_TIMEOUT):
                if token:
                    ai_chunks.append(token)
                    yield token
        except Exception as e:
            error_text = "Erreur IA pendant la génération."
            print(f"DEBUG: stream error -> {e}")
            yield error_text
            ai_chunks.append(error_text)
        finally:
            ai_text = "".join(ai_chunks).strip()
            if not ai_text:
                ai_text = "Réponse IA invalide"
            ai_message = models.ChatMessage(
                id_session=session_id,
                type_envoyeur="ai",
                contenu=ai_text
            )
            db.add(ai_message)
            db.commit()

    return StreamingResponse(stream_tokens(), media_type="text/plain")


# ── Message Feedback ──────────────────────────────────────────────────────────

@app.patch("/messages/{message_id}/feedback")
def rate_message(
    message_id: int,
    payload: schemas.MessageFeedbackRequest,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.feedback not in (1, -1):
        raise HTTPException(status_code=400, detail="feedback doit être 1 ou -1")

    message = db.query(models.ChatMessage).filter(models.ChatMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message introuvable")

    if message.type_envoyeur != "ai":
        raise HTTPException(status_code=400, detail="Le feedback n'est applicable qu'aux messages IA")

    session = db.query(models.ChatSession).filter(models.ChatSession.id == message.id_session).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session introuvable")

    user = get_user_by_email(db, current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    if not is_admin_or_sav(user) and session.id_utilisateur != user.id:
        raise HTTPException(status_code=403, detail="Accès refusé")

    message.feedback = payload.feedback
    db.commit()
    return {"ok": True}


# ── Human Transfer ────────────────────────────────────────────────────────────

VALID_REASONS = {"technique", "complexe", "sensible", "autre"}
REASON_LABELS = {
    "technique": "Technique",
    "complexe": "Complexe",
    "sensible": "Sensible",
    "autre": "Autre",
}
REASON_COLORS = {
    "technique": "#0ea5e9",
    "complexe": "#f59e0b",
    "sensible": "#ef4444",
    "autre": "#8b5cf6",
}

@app.post("/sessions/{session_id}/transfer", response_model=schemas.ChatSessionResponse)
def transfer_session(
    session_id: int,
    payload: schemas.TransferRequest,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.reason not in VALID_REASONS:
        raise HTTPException(status_code=400, detail=f"Raison invalide. Valeurs acceptées : {', '.join(VALID_REASONS)}")

    user = get_user_by_email(db, current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session introuvable")

    if session.id_utilisateur != user.id and not is_admin_or_sav(user):
        raise HTTPException(status_code=403, detail="Accès refusé")

    if session.status != "open":
        raise HTTPException(status_code=400, detail="Cette session ne peut pas être transférée.")

    session.status = "transferred"
    session.transfer_reason = payload.reason

    system_msg = models.ChatMessage(
        id_session=session_id,
        type_envoyeur="ai",
        contenu=f"Vous avez été mis en relation avec un agent humain. Raison : {REASON_LABELS.get(payload.reason, payload.reason)}.",
    )
    db.add(system_msg)
    db.commit()
    db.refresh(session)

    return {
        "id": session.id,
        "id_utilisateur": session.id_utilisateur,
        "title": session.title,
        "status": session.status,
        "transfer_reason": session.transfer_reason,
        "date_creation": session.date_creation,
    }


@app.post("/sessions/{session_id}/resolve", response_model=schemas.ChatSessionResponse)
def resolve_session(
    session_id: int,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = get_user_by_email(db, current_user)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if not is_admin_or_sav(user):
        raise HTTPException(status_code=403, detail="Accès refusé")

    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session introuvable")
    if session.status != "transferred":
        raise HTTPException(status_code=400, detail="Cette session n'est pas en transfert.")

    session.status = "open"
    session.transfer_reason = None

    system_msg = models.ChatMessage(
        id_session=session_id,
        type_envoyeur="ai",
        contenu="L'agent SAV a rétabli la conversation avec l'assistant IA.",
    )
    db.add(system_msg)
    db.commit()
    db.refresh(session)

    return {
        "id": session.id,
        "id_utilisateur": session.id_utilisateur,
        "title": session.title,
        "status": session.status,
        "transfer_reason": session.transfer_reason,
        "date_creation": session.date_creation,
    }


@app.get("/sessions/transferred")
def get_transferred_sessions(
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = get_user_by_email(db, current_user)
    if not is_admin_or_sav(user):
        raise HTTPException(status_code=403, detail="Accès refusé")

    rows = (
        db.query(models.ChatSession, models.Utilisateur.username)
        .join(models.Utilisateur, models.ChatSession.id_utilisateur == models.Utilisateur.id)
        .filter(models.ChatSession.status == "transferred")
        .order_by(models.ChatSession.date_creation.desc())
        .all()
    )

    return [
        {
            "id": s.id,
            "title": s.title,
            "status": s.status,
            "transfer_reason": s.transfer_reason,
            "date_creation": s.date_creation,
            "username": username,
        }
        for s, username in rows
    ]


# ── Analytics ─────────────────────────────────────────────────────────────────

@app.get("/analytics/stats")
def get_analytics_stats(
    days: int = 30,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = get_user_by_email(db, current_user)
    if not is_admin_or_sav(user):
        raise HTTPException(status_code=403, detail="Accès refusé")

    from sqlalchemy import func as sqlfunc
    from_date = datetime.utcnow() - timedelta(days=days)

    # Total sessions in period
    total_sessions = db.query(sqlfunc.count(models.ChatSession.id)).filter(
        models.ChatSession.date_creation >= from_date
    ).scalar() or 0

    # Sessions with at least one SAV message (transfers)
    transferred_sq = (
        db.query(models.ChatMessage.id_session)
        .filter(
            models.ChatMessage.type_envoyeur == "sav",
            models.ChatMessage.date_creation >= from_date,
        )
        .distinct()
        .subquery()
    )
    transferred_count = db.query(sqlfunc.count()).select_from(transferred_sq).scalar() or 0

    ai_resolution_rate = (
        round((total_sessions - transferred_count) / total_sessions * 100, 1)
        if total_sessions > 0 else 0.0
    )

    # Daily message counts grouped by day and sender type
    from sqlalchemy import case
    daily_rows = (
        db.query(
            sqlfunc.date_trunc("day", models.ChatMessage.date_creation).label("day"),
            models.ChatMessage.type_envoyeur,
            sqlfunc.count(models.ChatMessage.id).label("cnt"),
        )
        .filter(models.ChatMessage.date_creation >= from_date)
        .group_by("day", models.ChatMessage.type_envoyeur)
        .order_by("day")
        .all()
    )

    # Build day → {IA, Humain} map
    day_map: dict = {}
    for row in daily_rows:
        label = row.day.strftime("%-d %b") if row.day else "?"
        if label not in day_map:
            day_map[label] = {"name": label, "IA": 0, "Humain": 0}
        if row.type_envoyeur == "ai":
            day_map[label]["IA"] += row.cnt
        elif row.type_envoyeur == "sav":
            day_map[label]["Humain"] += row.cnt

    daily_messages = list(day_map.values())

    # Satisfaction score from thumbs-up feedback on AI messages
    total_rated = db.query(sqlfunc.count(models.ChatMessage.id)).filter(
        models.ChatMessage.type_envoyeur == "ai",
        models.ChatMessage.feedback.isnot(None),
        models.ChatMessage.date_creation >= from_date,
    ).scalar() or 0

    positive = db.query(sqlfunc.count(models.ChatMessage.id)).filter(
        models.ChatMessage.type_envoyeur == "ai",
        models.ChatMessage.feedback == 1,
        models.ChatMessage.date_creation >= from_date,
    ).scalar() or 0

    satisfaction_score = round(positive / total_rated * 5, 2) if total_rated > 0 else None

    # SAV agents
    sav_role = db.query(models.Role).filter(models.Role.nom_role == "sav").first()
    sav_agents = []
    if sav_role:
        sav_users = db.query(models.Utilisateur).filter(
            models.Utilisateur.id_role == sav_role.id
        ).all()
        per_agent = round(transferred_count / len(sav_users)) if sav_users else 0
        for u in sav_users:
            full_name = " ".join(filter(None, [u.prenom, u.nom])) or u.username
            initials = "".join(w[0].upper() for w in full_name.split()[:2])
            sav_agents.append({
                "name": full_name,
                "initials": initials,
                "conversations": per_agent,
            })

    # Transfer reason breakdown (real data)
    reason_rows = (
        db.query(models.ChatSession.transfer_reason, sqlfunc.count(models.ChatSession.id))
        .filter(
            models.ChatSession.transfer_reason.isnot(None),
            models.ChatSession.date_creation >= from_date,
        )
        .group_by(models.ChatSession.transfer_reason)
        .all()
    )
    transfer_reasons = [
        {
            "name": REASON_LABELS.get(r, r),
            "value": cnt,
            "color": REASON_COLORS.get(r, "#94a3b8"),
        }
        for r, cnt in reason_rows
    ]

    return {
        "total_sessions": total_sessions,
        "ai_resolution_rate": ai_resolution_rate,
        "transferred_count": transferred_count,
        "satisfaction_score": satisfaction_score,
        "daily_messages": daily_messages,
        "sav_agents": sav_agents,
        "transfer_reasons": transfer_reasons,
    }
