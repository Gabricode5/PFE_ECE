#déclares tes fonctions API (tes routes @app.post, @app.get, etc.).

from fastapi import FastAPI, HTTPException, Depends, status
import requests
import os
# On ajoute ces imports pour lire la base de données vectorielle
from langchain_community.vectorstores import Chroma
from langchain_ollama import OllamaEmbeddings
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import models, schemas
from database import engine, get_db
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()  # Charger les variables d'environnement depuis le fichier .env
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI(
    title="CRM Intelligent API",
    description="API pour un gestionnaire de tickets avec intégration IA",
    version="1.0.0", 
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3005"], # En développement, on autorise tout
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Remplace ta ligne SECRET_KEY par celle-ci pour tester
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))
DATABASE_URL = os.getenv("DATABASE_URL")

# CONFIGURATION
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
# C'est le dossier que tu as créé avec ingest.py
PERSIST_DIRECTORY = "./db_service_public"

# Initialisation de la fonction d'embedding (doit être la même que dans ingest.py)
embeddings = OllamaEmbeddings(model="llama3.2:1b", base_url=OLLAMA_URL)
# Récupération des URLs depuis le docker-compose
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:1b")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def create_access_token(data: dict):
    to_encode = data.copy()
    # Utilise datetime.now() au lieu de utcnow() pour tester
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    # Ajoute un print pour voir si ça bloque ici dans tes logs Docker
    print(f"DEBUG: Encoding token for {to_encode.get('sub')}") 
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

def get_user_by_email(db: Session, email: str):
    return db.query(models.Utilisateur).filter(models.Utilisateur.email == email).first()

def is_admin_or_sav(user: models.Utilisateur | None):
    if not user or not user.role:
        return False
    return user.role.nom_role in ["admin", "sav"]


@app.get("/")
def read_root():
    return {"status": "Online", "message": "Le gestionnaire de tickets avec RAG est prêt"}

# @app.post("/asks")
# async def ask_question(question: str):
#     """Route qui va chercher dans la base de données avant de répondre"""
#     try:
#         # 1. RECHERCHE : On ouvre la base de données et on cherche les textes pertinents
#         vector_db = Chroma(persist_directory=PERSIST_DIRECTORY, embedding_function=embeddings)
#         docs = vector_db.similarity_search(question, k=3) # Récupère les 3 meilleurs morceaux
        
#         # On combine les morceaux de texte trouvés
#         context = "\n".join([doc.page_content for doc in docs])
        
#         # 2. PROMPT : On donne le contexte à llama3.2:1b pour qu'il réponde précisément
#         prompt_intelligent = f"""
#         Tu es un assistant expert du site Service-Public.fr. 
#         Utilise exclusivement les informations ci-dessous pour répondre à la question.
#         Si la réponse n'est pas dans le contexte, dis poliment que tu ne sais pas.

#         CONTEXTE RÉCUPÉRÉ :
#         {context}

#         QUESTION DE L'UTILISATEUR :
#         {question}
#         """

#         # 3. GÉNÉRATION : Envoi à Ollama
#         payload = {
#             "model": "llama3.2:1b",
#             "prompt": prompt_intelligent,
#             "stream": False
#         }
        
#         response = requests.post(f"{OLLAMA_URL}/api/generate", json=payload)
#         response.raise_for_status()
#         result = response.json()
        
#         return {
#             "answer": result["response"],
#             "source_used": "Service-Public.fr (RAG local)"
#         }

#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Erreur IA : {str(e)}")

@app.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # 1. Vérifier si l'email existe déjà
    existing_user = db.query(models.Utilisateur).filter(models.Utilisateur.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé.")

    # 2. Hacher le mot de passe
    hashed_password = pwd_context.hash(user.password)

    # 3. Créer l'objet Utilisateur (on utilise user.id_role qui vient du schéma)
    new_user = models.Utilisateur(
        username=user.username,
        email=user.email,
        password_hash=hashed_password,
        prenom=user.prenom,
        nom=user.nom,
        id_role=user.id_role  # Utilise la valeur du schéma (ex: 1)
    )

    # 4. Sauvegarde
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    role_name = db.query(models.Role.nom_role).filter(models.Role.id == new_user.id_role).scalar() or "user"
    # 5. Retourner la réponse (doit correspondre à schemas.UserResponse)
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

    # 5. On renvoie tout au frontend
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "username": user.username,
        "user_id": user.id,
        "nom_role": role_name # C'est cette valeur que ton frontend va utiliser
    }

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
def create_session(session_data: schemas.ChatSessionCreate, user_id: int, db: Session = Depends(get_db)):
    # 1. Vérifier si l'utilisateur existe
    user = db.query(models.Utilisateur).filter(models.Utilisateur.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

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
def delete_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée")

    db.delete(session)
    db.commit()

    return

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
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    requester = get_user_by_email(db, current_user)
    if not requester or not is_admin_or_sav(requester):
        raise HTTPException(status_code=403, detail="Accès refusé")

    try:
        from ingest_postgres import ingest_to_postgres
        result = ingest_to_postgres(url=str(payload.url), category=payload.category)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur ingestion: {str(e)}")

@app.get("/check-ai")
def check_ai():
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags")
        return {"ollama_connected": True, "models": response.json()}
    except Exception as e:
        return {"ollama_connected": False, "error": str(e)}
    

@app.post("/ask")
async def ask_question(
    question: str,
    session_id: int,
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

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": f"Utilisateur {current_user} demande : {question}",
        "stream": False
    }
    response = requests.post(f"{OLLAMA_URL}/api/generate", json=payload)
    if not response.ok:
        try:
            error_payload = response.json()
            detail = error_payload.get("error") or error_payload.get("message") or str(error_payload)
        except Exception:
            detail = response.text or "Erreur Ollama"
        raise HTTPException(status_code=response.status_code, detail=detail)

    data = response.json()
    if isinstance(data, dict) and data.get("error"):
        raise HTTPException(status_code=500, detail=data.get("error"))
    ai_text = data.get("response") if isinstance(data, dict) else None
    if not ai_text:
        raise HTTPException(status_code=500, detail="Réponse IA invalide")

    ai_message = models.ChatMessage(
        id_session=session_id,
        type_envoyeur="ai",
        contenu=ai_text
    )
    db.add(ai_message)
    db.commit()
    db.refresh(ai_message)

    return data
