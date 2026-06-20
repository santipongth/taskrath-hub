-- pgvector already enabled via kb_chunks; ensure
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.source_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.user_projects(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.project_sources(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  content text NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_embeddings TO authenticated;
GRANT ALL ON public.source_embeddings TO service_role;

ALTER TABLE public.source_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage source_embeddings" ON public.source_embeddings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_source_embeddings_source ON public.source_embeddings(source_id);
CREATE INDEX idx_source_embeddings_project ON public.source_embeddings(user_id, project_id);
CREATE INDEX idx_source_embeddings_hnsw
  ON public.source_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_source_chunks(
  query_embedding vector(1536),
  p_project_id uuid,
  match_count int DEFAULT 6,
  similarity_threshold float DEFAULT 0.3
)
RETURNS TABLE (
  source_id uuid,
  chunk_index int,
  content text,
  similarity float,
  title text,
  url text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.source_id,
    e.chunk_index,
    e.content,
    1 - (e.embedding <=> query_embedding) AS similarity,
    s.title,
    s.url
  FROM public.source_embeddings e
  JOIN public.project_sources s ON s.id = e.source_id
  WHERE e.user_id = auth.uid()
    AND e.project_id = p_project_id
    AND 1 - (e.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

REVOKE EXECUTE ON FUNCTION public.match_source_chunks(vector, uuid, int, float) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_source_chunks(vector, uuid, int, float) TO authenticated;
