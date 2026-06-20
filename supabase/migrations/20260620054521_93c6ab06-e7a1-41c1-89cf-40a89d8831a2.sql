CREATE TABLE public.transformations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  prompt text NOT NULL,
  icon text,
  is_default boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transformations TO authenticated;
GRANT ALL ON public.transformations TO service_role;

ALTER TABLE public.transformations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage transformations" ON public.transformations
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_transformations_updated_at
  BEFORE UPDATE ON public.transformations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_transformations_owner ON public.transformations(owner_id, sort_order);
