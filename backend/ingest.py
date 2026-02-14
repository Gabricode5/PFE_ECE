import os
from langchain_community.document_loaders import WebBaseLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_ollama import OllamaEmbeddings

# Configuration
# "db_service_public" est le dossier qui contiendra la mémoire de l'IA
PERSIST_DIRECTORY = "./db_service_public"
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")

def run_ingestion():
    # 1. RÉCUPÉRATION (Scraping)
    url = "https://www.service-public.fr/particuliers/vosdroits/F1342"
    print(f"--- Lecture du site : {url} ---")
    
    loader = WebBaseLoader(url)
    data = loader.load()

    # 2. DÉCOUPAGE (Chunking)
    # On découpe en morceaux de 600 caractères pour que l'IA retrouve vite l'info
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=100)
    chunks = text_splitter.split_documents(data)
    print(f"--- Texte découpé en {len(chunks)} morceaux ---")

    # 3. STOCKAGE (Vector Database)
    # On utilise ton modèle Mistral pour "comprendre" et stocker les textes
    print("--- Création de la mémoire vectorielle... ---")
    embeddings = OllamaEmbeddings(model="mistral-small", base_url=OLLAMA_URL)
    
    vector_db = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=PERSIST_DIRECTORY
    )
    
    print(f"--- TERMINÉ : Les données sont prêtes dans {PERSIST_DIRECTORY} ---")

if __name__ == "__main__":
    run_ingestion()
    