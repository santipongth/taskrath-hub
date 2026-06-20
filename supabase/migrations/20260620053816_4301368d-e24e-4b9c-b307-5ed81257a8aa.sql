
-- project_sources
CREATE TABLE public.project_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.user_projects(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('url','file','text','research')),
  title text NOT NULL,
  url text,
  file_path text,
  content_md text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_sources_project_idx ON public.project_sources(project_id, created_at DESC);
CREATE INDEX project_sources_user_idx ON public.project_sources(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_sources TO authenticated;
GRANT ALL ON public.project_sources TO service_role;

ALTER TABLE public.project_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own sources select" ON public.project_sources
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own sources insert" ON public.project_sources
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sources update" ON public.project_sources
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sources delete" ON public.project_sources
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER project_sources_set_updated_at
  BEFORE UPDATE ON public.project_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- project_notes
CREATE TABLE public.project_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.user_projects(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.project_sources(id) ON DELETE SET NULL,
  title text NOT NULL,
  content_md text NOT NULL DEFAULT '',
  origin text NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual','ai','transformation')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_notes_project_idx ON public.project_notes(project_id, created_at DESC);
CREATE INDEX project_notes_user_idx ON public.project_notes(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_notes TO authenticated;
GRANT ALL ON public.project_notes TO service_role;

ALTER TABLE public.project_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notes select" ON public.project_notes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notes insert" ON public.project_notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notes update" ON public.project_notes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notes delete" ON public.project_notes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER project_notes_set_updated_at
  BEFORE UPDATE ON public.project_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
