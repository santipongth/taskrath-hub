
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('user', 'approver', 'admin');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  department TEXT,
  language_pref TEXT NOT NULL DEFAULT 'th',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- AI runs
CREATE TABLE public.ai_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id TEXT,
  title TEXT,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  needs_approval BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX ai_runs_user_created_idx ON public.ai_runs (user_id, created_at DESC);

-- Approvals
CREATE TABLE public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.ai_runs(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
CREATE INDEX approvals_status_idx ON public.approvals (status, created_at DESC);

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX audit_logs_created_idx ON public.audit_logs (created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Profile auto-create
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS POLICIES
-- profiles
CREATE POLICY "Users read own profile" ON public.profiles
FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON public.profiles
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "Users read own roles" ON public.user_roles
FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ai_runs
CREATE POLICY "Users read own runs" ON public.ai_runs
FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own runs" ON public.ai_runs
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own runs" ON public.ai_runs
FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own runs" ON public.ai_runs
FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Approvers read flagged runs" ON public.ai_runs
FOR SELECT TO authenticated USING (
  needs_approval = true AND (public.has_role(auth.uid(), 'approver') OR public.has_role(auth.uid(), 'admin'))
);

-- approvals
CREATE POLICY "Requesters read own approvals" ON public.approvals
FOR SELECT TO authenticated USING (auth.uid() = requester_id);
CREATE POLICY "Requesters insert own approvals" ON public.approvals
FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Approvers read all approvals" ON public.approvals
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'approver') OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Approvers update approvals" ON public.approvals
FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'approver') OR public.has_role(auth.uid(), 'admin')
);

-- audit_logs
CREATE POLICY "Users read own audit logs" ON public.audit_logs
FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all audit logs" ON public.audit_logs
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own audit logs" ON public.audit_logs
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
