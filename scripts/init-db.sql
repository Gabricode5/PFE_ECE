-- Active l'extension pour les recherches de similarité
CREATE EXTENSION IF NOT EXISTS vector;

-- Table pour stocker les connaissances (FAQ, Guides)
CREATE TABLE IF NOT EXISTS knowledge_base (
    id SERIAL PRIMARY KEY,
    title TEXT,
    content TEXT,
    embedding vector(768) -- Taille spécifique pour nomic-embed-text
);

-- Table simple pour les tickets
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    subject TEXT,
    description TEXT,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);