
-- 1. Providers table
CREATE TABLE public.dept_model_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('lovable','openai_compatible','typhoon','hiclaw')),
  base_url text,
  model_id text NOT NULL,
  api_key_secret_name text,
  price_in_per_mtok numeric(10,4) NOT NULL DEFAULT 0,
  price_out_per_mtok numeric(10,4) NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dept_model_providers TO authenticated;
GRANT ALL ON public.dept_model_providers TO service_role;

ALTER TABLE public.dept_model_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dept members can read providers"
  ON public.dept_model_providers FOR SELECT TO authenticated
  USING (public.is_in_department(auth.uid(), department) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "dept admins manage providers"
  ON public.dept_model_providers FOR ALL TO authenticated
  USING (public.is_dept_admin(auth.uid(), department))
  WITH CHECK (public.is_dept_admin(auth.uid(), department));

CREATE TRIGGER set_dept_model_providers_updated_at
  BEFORE UPDATE ON public.dept_model_providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX dept_model_providers_dept_idx ON public.dept_model_providers(department);

-- 2. Routes table (fallback chains)
CREATE TABLE public.dept_model_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  chain jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dept_model_routes TO authenticated;
GRANT ALL ON public.dept_model_routes TO service_role;

ALTER TABLE public.dept_model_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dept members can read routes"
  ON public.dept_model_routes FOR SELECT TO authenticated
  USING (public.is_in_department(auth.uid(), department) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "dept admins manage routes"
  ON public.dept_model_routes FOR ALL TO authenticated
  USING (public.is_dept_admin(auth.uid(), department))
  WITH CHECK (public.is_dept_admin(auth.uid(), department));

CREATE TRIGGER set_dept_model_routes_updated_at
  BEFORE UPDATE ON public.dept_model_routes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX dept_model_routes_dept_idx ON public.dept_model_routes(department);
CREATE UNIQUE INDEX dept_model_routes_one_default
  ON public.dept_model_routes(department) WHERE is_default;

-- 3. ai_runs metadata for routing
ALTER TABLE public.ai_runs
  ADD COLUMN IF NOT EXISTS provider_kind text,
  ADD COLUMN IF NOT EXISTS provider_id uuid,
  ADD COLUMN IF NOT EXISTS attempts jsonb;
