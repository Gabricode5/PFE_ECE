from fastapi import FastAPI, HTTPException
import requests
import os
# On ajoute ces imports pour lire la base de données vectorielle
from langchain_community.vectorstores import Chroma
from langchain_ollama import OllamaEmbeddings

app = FastAPI(title="CRM Intelligent API")

# CONFIGURATION
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
# C'est le dossier que tu as créé avec ingest.py
PERSIST_DIRECTORY = "./db_service_public"

# Initialisation de la fonction d'embedding (doit être la même que dans ingest.py)
embeddings = OllamaEmbeddings(model="mistral-small", base_url=OLLAMA_URL)

@app.get("/")
def read_root():
    return {"status": "Online", "message": "Le gestionnaire de tickets avec RAG est prêt"}

@app.post("/ask")
async def ask_question(question: str):
    """Route qui va chercher dans la base de données avant de répondre"""
    try:
        # 1. RECHERCHE : On ouvre la base de données et on cherche les textes pertinents
        vector_db = Chroma(persist_directory=PERSIST_DIRECTORY, embedding_function=embeddings)
        docs = vector_db.similarity_search(question, k=3) # Récupère les 3 meilleurs morceaux
        
        # On combine les morceaux de texte trouvés
        context = "\n".join([doc.page_content for doc in docs])
        
        # 2. PROMPT : On donne le contexte à Mistral pour qu'il réponde précisément
        prompt_intelligent = f"""
        Tu es un assistant expert du site Service-Public.fr. 
        Utilise exclusivement les informations ci-dessous pour répondre à la question.
        Si la réponse n'est pas dans le contexte, dis poliment que tu ne sais pas.

        CONTEXTE RÉCUPÉRÉ :
        {context}

        QUESTION DE L'UTILISATEUR :
        {question}
        """

        # 3. GÉNÉRATION : Envoi à Ollama
        payload = {
            "model": "mistral-small",
            "prompt": prompt_intelligent,
            "stream": False
        }
        
        response = requests.post(f"{OLLAMA_URL}/api/generate", json=payload)
        response.raise_for_status()
        result = response.json()
        
        return {
            "answer": result["response"],
            "source_used": "Service-Public.fr (RAG local)"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur IA : {str(e)}")

@app.get("/check-ai")
def check_ai():
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags")
        return {"ollama_connected": True, "models": response.json()}
    except Exception as e:
        return {"ollama_connected": False, "error": str(e)}
    