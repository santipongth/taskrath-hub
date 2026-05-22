
ALTER TABLE public.ai_runs
  ADD COLUMN IF NOT EXISTS prompt_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_usd numeric(10,6) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS ai_runs_created_at_idx ON public.ai_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_runs_user_id_idx ON public.ai_runs (user_id);

CREATE POLICY "Admins read all runs"
  ON public.ai_runs
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
