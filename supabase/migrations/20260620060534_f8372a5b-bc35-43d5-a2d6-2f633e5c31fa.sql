
CREATE POLICY "notebook-files: read own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'notebook-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "notebook-files: insert own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'notebook-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "notebook-files: update own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'notebook-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "notebook-files: delete own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'notebook-files' AND auth.uid()::text = (storage.foldername(name))[1]);
