-- One-time migration to enable pgvector extension
-- This must be executed before creating tables that use the VECTOR type.

CREATE EXTENSION IF NOT EXISTS vector;
