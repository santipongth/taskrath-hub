
CREATE POLICY "agency-assets read for authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'agency-assets');

CREATE POLICY "agency-assets admin insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'agency-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "agency-assets admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'agency-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "agency-assets admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'agency-assets' AND public.has_role(auth.uid(), 'admin'));
