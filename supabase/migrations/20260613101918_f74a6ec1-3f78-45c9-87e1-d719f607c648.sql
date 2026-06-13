
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signature_data_url text,
  ADD COLUMN IF NOT EXISTS signer_position text;

CREATE TABLE IF NOT EXISTS public.signed_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.ai_runs(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signer_name text NOT NULL,
  signer_position text NOT NULL DEFAULT '',
  agency_name text NOT NULL DEFAULT '',
  document_subject text NOT NULL DEFAULT '',
  ref_no text NOT NULL DEFAULT '',
  content_hash text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signed_documents_user_idx ON public.signed_documents(user_id);
CREATE INDEX IF NOT EXISTS signed_documents_run_idx ON public.signed_documents(run_id);

GRANT SELECT, INSERT ON public.signed_documents TO authenticated;
GRANT SELECT ON public.signed_documents TO anon;
GRANT ALL ON public.signed_documents TO service_role;

ALTER TABLE public.signed_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can verify signatures"
  ON public.signed_documents FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users insert own signatures"
  ON public.signed_documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
