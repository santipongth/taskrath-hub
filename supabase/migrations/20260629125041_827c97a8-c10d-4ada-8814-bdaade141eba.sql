CREATE TABLE public.shared_skill_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES public.shared_skills(id) ON DELETE CASCADE,
  version_no integer NOT NULL,
  name text NOT NULL,
  description text,
  role_prompt text NOT NULL,
  conversation_starters text[] NOT NULL DEFAULT '{}',
  recommended_model text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (skill_id, version_no)
);

CREATE INDEX shared_skill_versions_skill_id_created_at_idx
  ON public.shared_skill_versions (skill_id, created_at DESC);

GRANT SELECT, INSERT ON public.shared_skill_versions TO authenticated;
GRANT ALL ON public.shared_skill_versions TO service_role;

ALTER TABLE public.shared_skill_versions ENABLE ROW LEVEL SECURITY;

-- Read: only admins / dept_admins
CREATE POLICY "skill versions readable by managers"
ON public.shared_skill_versions FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'dept_admin')
);

-- Insert: same managers
CREATE POLICY "skill versions insertable by managers"
ON public.shared_skill_versions FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'dept_admin')
);