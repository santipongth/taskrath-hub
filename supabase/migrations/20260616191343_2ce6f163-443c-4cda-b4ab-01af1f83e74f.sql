
-- Helpers
CREATE OR REPLACE FUNCTION public.is_in_department(_user_id uuid, _dept text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND department IS NOT NULL AND department = _dept
  )
$$;

CREATE OR REPLACE FUNCTION public.is_dept_admin(_user_id uuid, _dept text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR (public.has_role(_user_id, 'dept_admin'::app_role)
          AND public.is_in_department(_user_id, _dept))
$$;

-- dept_skills
CREATE TABLE public.dept_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  name text NOT NULL,
  description text,
  system_prompt text NOT NULL DEFAULT '',
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  kb_category text,
  model text,
  needs_approval boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dept_skills TO authenticated;
GRANT ALL ON public.dept_skills TO service_role;
ALTER TABLE public.dept_skills ENABLE ROW LEVEL SECURITY;
CREATE INDEX dept_skills_dept_idx ON public.dept_skills(department);

CREATE POLICY "members read dept_skills" ON public.dept_skills
  FOR SELECT TO authenticated
  USING (public.is_in_department(auth.uid(), department) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "dept_admins insert dept_skills" ON public.dept_skills
  FOR INSERT TO authenticated
  WITH CHECK (public.is_dept_admin(auth.uid(), department));
CREATE POLICY "dept_admins update dept_skills" ON public.dept_skills
  FOR UPDATE TO authenticated
  USING (public.is_dept_admin(auth.uid(), department))
  WITH CHECK (public.is_dept_admin(auth.uid(), department));
CREATE POLICY "dept_admins delete dept_skills" ON public.dept_skills
  FOR DELETE TO authenticated
  USING (public.is_dept_admin(auth.uid(), department));

CREATE TRIGGER trg_dept_skills_updated_at BEFORE UPDATE ON public.dept_skills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- dept_agents
CREATE TABLE public.dept_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  name text NOT NULL,
  description text,
  role_prompt text NOT NULL DEFAULT '',
  default_model text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dept_agents TO authenticated;
GRANT ALL ON public.dept_agents TO service_role;
ALTER TABLE public.dept_agents ENABLE ROW LEVEL SECURITY;
CREATE INDEX dept_agents_dept_idx ON public.dept_agents(department);

CREATE POLICY "members read dept_agents" ON public.dept_agents
  FOR SELECT TO authenticated
  USING (public.is_in_department(auth.uid(), department) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "dept_admins insert dept_agents" ON public.dept_agents
  FOR INSERT TO authenticated
  WITH CHECK (public.is_dept_admin(auth.uid(), department));
CREATE POLICY "dept_admins update dept_agents" ON public.dept_agents
  FOR UPDATE TO authenticated
  USING (public.is_dept_admin(auth.uid(), department))
  WITH CHECK (public.is_dept_admin(auth.uid(), department));
CREATE POLICY "dept_admins delete dept_agents" ON public.dept_agents
  FOR DELETE TO authenticated
  USING (public.is_dept_admin(auth.uid(), department));

CREATE TRIGGER trg_dept_agents_updated_at BEFORE UPDATE ON public.dept_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- dept_agent_skills (junction)
CREATE TABLE public.dept_agent_skills (
  agent_id uuid NOT NULL REFERENCES public.dept_agents(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.dept_skills(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  PRIMARY KEY (agent_id, skill_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dept_agent_skills TO authenticated;
GRANT ALL ON public.dept_agent_skills TO service_role;
ALTER TABLE public.dept_agent_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read agent_skills" ON public.dept_agent_skills
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.dept_agents a
    WHERE a.id = agent_id
      AND (public.is_in_department(auth.uid(), a.department) OR public.has_role(auth.uid(), 'admin'::app_role))
  ));
CREATE POLICY "dept_admins write agent_skills" ON public.dept_agent_skills
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.dept_agents a
    WHERE a.id = agent_id AND public.is_dept_admin(auth.uid(), a.department)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.dept_agents a
    WHERE a.id = agent_id AND public.is_dept_admin(auth.uid(), a.department)
  ));

-- ai_runs: link to dept agent/skill/department
ALTER TABLE public.ai_runs
  ADD COLUMN IF NOT EXISTS dept_agent_id uuid REFERENCES public.dept_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dept_skill_id uuid REFERENCES public.dept_skills(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS department text;

CREATE INDEX IF NOT EXISTS ai_runs_dept_agent_idx ON public.ai_runs(dept_agent_id);
CREATE INDEX IF NOT EXISTS ai_runs_department_idx ON public.ai_runs(department);
