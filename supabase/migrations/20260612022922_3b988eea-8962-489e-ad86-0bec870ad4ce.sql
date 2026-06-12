
CREATE TABLE public.custom_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title_th TEXT NOT NULL,
  title_en TEXT NOT NULL DEFAULT '',
  desc_th TEXT NOT NULL DEFAULT '',
  desc_en TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'letter',
  icon TEXT NOT NULL DEFAULT 'FileText',
  system_prompt_th TEXT NOT NULL,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_templates TO authenticated;
GRANT ALL ON public.custom_templates TO service_role;

ALTER TABLE public.custom_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active templates"
  ON public.custom_templates FOR SELECT
  TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert templates"
  ON public.custom_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update templates"
  ON public.custom_templates FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete templates"
  ON public.custom_templates FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_custom_templates_updated_at
  BEFORE UPDATE ON public.custom_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
