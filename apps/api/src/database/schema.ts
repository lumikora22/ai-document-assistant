/**
 * Initialization SQL applied on API startup.
 *
 * Enables the pgvector extension and creates the two tables used by the
 * RAG pipeline. Statements are idempotent so repeated startups are safe.
 * The embedding dimension (384) matches the Xenova/all-MiniLM-L6-v2 model.
 */
export const INIT_SQL = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  pages INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  page INTEGER NOT NULL,
  embedding vector(384) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
`;
