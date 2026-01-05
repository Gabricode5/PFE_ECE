-- Active l'extension pour l'IA
CREATE EXTENSION IF NOT EXISTS vector;

-- Crée la table pour stocker tes documents et leurs "sens" (embeddings)
CREATE TABLE IF NOT EXISTS knowledge_base (
    id SERIAL PRIMARY KEY,
    title TEXT,
    content TEXT,
    embedding vector(768) -- 768 est la taille du modèle nomic-embed-text
);