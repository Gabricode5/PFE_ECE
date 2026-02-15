import os
from langchain_community.document_loaders import WebBaseLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings
from langchain_community.vectorstores import Chroma

# Configuration
URL = "https://www.service-public.fr/particuliers/vosdroits/F1342"
PERSIST_DIRECTORY = "backend/db"

def run_ingestion():
    # 1. Scraping du site
    print(f"--- Lecture du site : {URL} ---")
    loader = WebBaseLoader(URL)
    # On ajoute un User-Agent pour simuler un vrai navigateur
    loader.requests_kwargs = {'headers': {'User-Agent': 'Mozilla/5.0'}}
    docs = loader.load()

    # 2. Découpage du texte (Chunking)
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunks = text_splitter.split_documents(docs)
    print(f"--- Texte découpé en {len(chunks)} morceaux ---")

    # 3. Création des Embeddings avec le modèle léger
    print("--- Création de la mémoire vectorielle (Nomic) ---")
    embeddings = OllamaEmbeddings(
        model="nomic-embed-text",  # <--- CHANGEMENT ICI (Léger et rapide)
        base_url="http://localhost:11434"
    )

    # 4. Stockage dans la base de données
    vector_db = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=PERSIST_DIRECTORY
    )
    
    print("--- Terminé ! Les données sont enregistrées dans la base. ---")

if __name__ == "__main__":
    run_ingestion()