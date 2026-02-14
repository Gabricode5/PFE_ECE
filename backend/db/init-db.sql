-- 1. Activer l'extension pour l'IA
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Création de la table des rôles
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    nom_role VARCHAR(20) UNIQUE NOT NULL
);

-- Insertion des rôles par défaut
INSERT INTO roles (nom_role) VALUES ('user'), ('ai'), ('sav'), ('admin');

-- 3. Création de la table utilisateur (liée à roles)
CREATE TABLE utilisateur (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    prenom VARCHAR(50),
    nom VARCHAR(50),
    id_role INTEGER REFERENCES roles(id) DEFAULT 1, -- Pointe vers 'user' par défaut
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Création des sessions de chat
CREATE TABLE chat_sessions (
    id SERIAL PRIMARY KEY,
    id_utilisateur INTEGER REFERENCES utilisateur(id) ON DELETE CASCADE,
    title VARCHAR(255),
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Création des messages
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    id_session INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
    type_envoyeur VARCHAR(10) CHECK (type_envoyeur IN ('user', 'ai', 'sav')),
    contenu TEXT NOT NULL,
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Table pour la base de connaissances (RAG)
CREATE TABLE knowledge_base (
    id SERIAL PRIMARY KEY,
    source_message_id INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL,
    contenu TEXT NOT NULL,
    embedding vector(768), 
    category VARCHAR(50),
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index pour accélérer les recherches de l'IA
CREATE INDEX ON knowledge_base USING hnsw (embedding vector_cosine_ops);

-- insertion des statuts dans la table role 
INSERT INTO roles (nom_role) VALUES ('user'), ('ai'), ('sav'), ('admin');