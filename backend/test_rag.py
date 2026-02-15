from langchain_ollama import OllamaEmbeddings
from langchain_postgres.vectorstores import PGVector
from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

# 1. Configuration - On utilise le port 5434 que nous avons ouvert
CONNECTION_STRING = "postgresql+psycopg://admin:Password1234@localhost:5434/ticketdb"
COLLECTION_NAME = "knowledge_base"

def test_ai_response():
    print("🤖 Connexion à la base de données Postgres (Port 5434)...")
    
    # 2. Configuration des Embeddings (pour la recherche)
    # On précise bien localhost:11434 pour atteindre le Docker
    embeddings = OllamaEmbeddings(
        model="nomic-embed-text:latest",
        base_url="http://localhost:11434"
    )

    # 3. Connexion au Vector Store
    vector_store = PGVector(
        connection=CONNECTION_STRING,
        collection_name=COLLECTION_NAME,
        embeddings=embeddings,
    )

    # 4. Configuration du Modèle de langage (Llama 3.2)
    llm = ChatOllama(
        model="llama3.2:1b",
        base_url="http://localhost:11434"
    )

    # 5. Création du Prompt (les instructions pour l'IA)
    template = """Réponds à la question de l'utilisateur de manière précise en utilisant uniquement le contexte fourni. 
    Si tu ne trouves pas la réponse dans le contexte, dis simplement que tu ne sais pas.

    CONTEXTE :
    {context}
    
    QUESTION : {question}
    
    RÉPONSE :"""
    
    prompt = ChatPromptTemplate.from_template(template)

    # 6. Mise en place de la chaîne de recherche (Retriever)
    retriever = vector_store.as_retriever(search_kwargs={"k": 3})

    def format_docs(docs):
        return "\n\n".join(doc.page_content for doc in docs)

    # Construction de la chaîne RAG
    rag_chain = (
        {"context": retriever | format_docs, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )

    # 7. Exécution du test
    query = "Quels sont les documents à fournir pour une demande de carte d'identité ?"
    print(f"❓ Question posée : {query}")
    print("\n💡 Réponse de l'IA (basée sur tes 31 morceaux) :\n")
    
    try:
        for chunk in rag_chain.stream(query):
            print(chunk, end="", flush=True)
        print("\n")
    except Exception as e:
        print(f"\n❌ Erreur lors de la génération : {e}")

if __name__ == "__main__":
    test_ai_response()