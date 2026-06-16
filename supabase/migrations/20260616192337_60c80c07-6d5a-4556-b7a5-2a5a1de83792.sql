CREATE POLICY "Dept admins read department runs" ON public.ai_runs
FOR SELECT TO authenticated
USING (
  department IS NOT NULL
  AND public.is_dept_admin(auth.uid(), department)
);