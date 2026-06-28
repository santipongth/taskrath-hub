
-- Make department optional on shared_skills (single-tenant model)
ALTER TABLE public.shared_skills ALTER COLUMN department DROP NOT NULL;

-- Drop department-scoped policies
DROP POLICY IF EXISTS "dept_admins delete shared_skills" ON public.shared_skills;
DROP POLICY IF EXISTS "dept_admins insert shared_skills" ON public.shared_skills;
DROP POLICY IF EXISTS "dept_admins update shared_skills" ON public.shared_skills;
DROP POLICY IF EXISTS "members read shared_skills" ON public.shared_skills;

-- New simple policies: any signed-in user reads active skills; admin or dept_admin manages
CREATE POLICY "authenticated read active shared_skills"
ON public.shared_skills
FOR SELECT
TO authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'dept_admin'::app_role));

CREATE POLICY "admins insert shared_skills"
ON public.shared_skills
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'dept_admin'::app_role));

CREATE POLICY "admins update shared_skills"
ON public.shared_skills
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'dept_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'dept_admin'::app_role));

CREATE POLICY "admins delete shared_skills"
ON public.shared_skills
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'dept_admin'::app_role));
