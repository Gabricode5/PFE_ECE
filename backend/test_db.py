from langchain_ollama import OllamaEmbeddings
from langchain_community.vectorstores import Chroma

# Configuration - On reste sur les mêmes chemins que ingest.py
PERSIST_DIRECTORY = "backend/db"

def test_query():
    print("--- Connexion à la base de données... ---")
    
    # On précise bien le nom complet et l'URL locale
    embeddings = OllamaEmbeddings(
        model="nomic-embed-text:latest", 
        base_url="http://localhost:11434"
    )
    
    # Chargement de la base
    vector_db = Chroma(
        persist_directory=PERSIST_DIRECTORY, 
        embedding_function=embeddings
    )

    # Ta question
    query = "Quels sont les documents sur le transport ?"
    print(f"--- Recherche pour : '{query}' ---")
    
    # Recherche
    docs = vector_db.similarity_search(query, k=2)

    if len(docs) > 0:
        print(f"--- Succès ! {len(docs)} morceaux trouvés ---")
        for i, doc in enumerate(docs):
            print(f"\nExtrait {i+1} :\n{doc.page_content[:300]}...")
    else:
        print("--- La base est vide ou la recherche n'a rien donné ---")

if __name__ == "__main__":
    test_query()