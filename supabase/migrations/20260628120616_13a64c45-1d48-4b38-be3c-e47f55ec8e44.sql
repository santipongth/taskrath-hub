-- Drop legacy agent tables (no data)
ALTER TABLE IF EXISTS public.ai_runs DROP CONSTRAINT IF EXISTS ai_runs_dept_skill_id_fkey;
ALTER TABLE IF EXISTS public.ai_runs DROP CONSTRAINT IF EXISTS ai_runs_dept_agent_id_fkey;
DROP TABLE IF EXISTS public.dept_agent_skills CASCADE;
DROP TABLE IF EXISTS public.dept_skills CASCADE;
DROP TABLE IF EXISTS public.dept_agents CASCADE;

-- New shared skills table
CREATE TABLE public.shared_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  name text NOT NULL,
  icon text,
  category text,
  description text,
  example_output text,
  role_prompt text NOT NULL,
  default_model_selector text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shared_skills_dept_idx ON public.shared_skills(department, is_active, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_skills TO authenticated;
GRANT ALL ON public.shared_skills TO service_role;

ALTER TABLE public.shared_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read shared_skills" ON public.shared_skills
  FOR SELECT TO authenticated
  USING (is_in_department(auth.uid(), department) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "dept_admins insert shared_skills" ON public.shared_skills
  FOR INSERT TO authenticated
  WITH CHECK (is_dept_admin(auth.uid(), department));

CREATE POLICY "dept_admins update shared_skills" ON public.shared_skills
  FOR UPDATE TO authenticated
  USING (is_dept_admin(auth.uid(), department))
  WITH CHECK (is_dept_admin(auth.uid(), department));

CREATE POLICY "dept_admins delete shared_skills" ON public.shared_skills
  FOR DELETE TO authenticated
  USING (is_dept_admin(auth.uid(), department));

CREATE TRIGGER trg_shared_skills_updated_at
  BEFORE UPDATE ON public.shared_skills
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ai_runs reference to shared_skills
ALTER TABLE public.ai_runs DROP COLUMN IF EXISTS dept_agent_id;
ALTER TABLE public.ai_runs DROP COLUMN IF EXISTS dept_skill_id;
ALTER TABLE public.ai_runs ADD COLUMN IF NOT EXISTS shared_skill_id uuid REFERENCES public.shared_skills(id) ON DELETE SET NULL;
ALTER TABLE public.ai_runs ADD COLUMN IF NOT EXISTS user_skill_id uuid REFERENCES public.user_skills(id) ON DELETE SET NULL;