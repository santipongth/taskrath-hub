-- Enable realtime updates for ai_runs so the UI can stream per-step progress.
ALTER TABLE public.ai_runs REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ai_runs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_runs';
  END IF;
END $$;