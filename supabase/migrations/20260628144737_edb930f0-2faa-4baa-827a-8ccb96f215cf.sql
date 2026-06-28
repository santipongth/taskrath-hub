
ALTER TABLE public.shared_skills
  DROP COLUMN IF EXISTS department,
  DROP COLUMN IF EXISTS default_model_selector,
  ADD COLUMN IF NOT EXISTS conversation_starters text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recommended_model text;
