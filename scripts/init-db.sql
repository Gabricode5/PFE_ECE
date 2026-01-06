CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE utilisateur (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    prenom VARCHAR(50),
    nom VARCHAR(50),
    role VARCHAR(20) DEFAULT 'user',
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_sessions (
    id SERIAL PRIMARY KEY,
    id_utilisateur INTEGER REFERENCES utilisateur(id) ON DELETE CASCADE,
    title VARCHAR(255),
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    id_session INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
    type_envoyeur VARCHAR(10) CHECK (type_envoyeur IN ('user', 'ai')),
    contenu TEXT NOT NULL,
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE knowledge_base (
    id SERIAL PRIMARY KEY,
    source_message_id INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL,
    contenu TEXT NOT NULL,
    embedding vector(768), -- Taille adaptée à ton modèle Ollama
    category VARCHAR(50),
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ON knowledge_base USING hnsw (embedding vector_cosine_ops);