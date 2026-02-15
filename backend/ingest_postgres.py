import os
from langchain_community.document_loaders import WebBaseLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings
from langchain_postgres.vectorstores import PGVector

# 1. Configuration
URL = "https://www.service-public.fr/particuliers/vosdroits/F1342"
CONNECTION_STRING = "postgresql+psycopg://admin:Password1234@localhost:5434/ticketdb"
COLLECTION_NAME = "knowledge_base"

def ingest_to_postgres():
    print(f"Début de l'ingestion vers PostgreSQL depuis : {URL}")

    # 2. Scraping en direct (comme dans ton ingest.py)
    loader = WebBaseLoader(URL)
    loader.requests_kwargs = {'headers': {'User-Agent': 'Mozilla/5.0'}}
    docs = loader.load()
    print("Site chargé avec succès.")

    # 3. Découpage du texte (Chunking)
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunks = text_splitter.split_documents(docs)
    print(f"✂️ {len(chunks)} morceaux créés.")

    # 4. Modèle d'embedding (Nomic 768)
    embeddings = OllamaEmbeddings(
        model="nomic-embed-text",
        base_url="http://localhost:11434"
    )

    # 5. Envoi vers PostgreSQL via PGVector
    print("Connexion à Postgres et insertion des vecteurs...")
    
    vector_store = PGVector.from_documents(
        embedding=embeddings,
        documents=chunks,
        collection_name=COLLECTION_NAME,
        connection=CONNECTION_STRING,
        use_jsonb=True,
    )

    print("✅ Mission accomplie ! Les données du site sont dans la table 'knowledge_base'.")

if __name__ == "__main__":
    ingest_to_postgres()