from fastapi import FastAPI, HTTPException
import requests
import os

app = FastAPI(title="CRM Intelligent API")

# Récupération des URLs depuis le docker-compose
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")

@app.get("/")
def read_root():
    return {"status": "Online", "message": "Le gestionnaire de tickets est prêt"}

@app.get("/check-ai")
def check_ai():
    """Vérifie si le backend peut parler à Ollama"""
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags")
        return {"ollama_connected": True, "models": response.json()}
    except Exception as e:
        return {"ollama_connected": False, "error": str(e)}

@app.post("/ask")
async def ask_question(question: str):
    """Route simple pour tester l'IA"""
    payload = {
        "model": "mistral-small",
        "prompt": question,
        "stream": False
    }
    response = requests.post(f"{OLLAMA_URL}/api/generate", json=payload)
    return response.json()