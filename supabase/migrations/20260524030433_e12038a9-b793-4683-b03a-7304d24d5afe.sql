
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.kb_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  source TEXT,
  storage_path TEXT,
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  chunk_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kb_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read kb_documents" ON public.kb_documents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert kb_documents" ON public.kb_documents
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update kb_documents" ON public.kb_documents
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete kb_documents" ON public.kb_documents
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER kb_documents_updated_at
  BEFORE UPDATE ON public.kb_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.kb_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.kb_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  tokens INTEGER NOT NULL DEFAULT 0,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kb_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read kb_chunks" ON public.kb_chunks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert kb_chunks" ON public.kb_chunks
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete kb_chunks" ON public.kb_chunks
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX kb_chunks_document_id_idx ON public.kb_chunks(document_id);
CREATE INDEX kb_chunks_embedding_idx ON public.kb_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_kb_chunks(
  query_embedding vector(1536),
  match_count integer DEFAULT 5,
  similarity_threshold float DEFAULT 0.0
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_index integer,
  content text,
  similarity float,
  title text,
  category text,
  source text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    c.id,
    c.document_id,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity,
    d.title,
    d.category,
    d.source
  FROM public.kb_chunks c
  JOIN public.kb_documents d ON d.id = c.document_id
  WHERE d.status = 'ready'
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('kb-files', 'kb-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated read kb-files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'kb-files');
CREATE POLICY "Admins insert kb-files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'kb-files' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update kb-files" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'kb-files' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete kb-files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'kb-files' AND has_role(auth.uid(), 'admin'::app_role));
