-- Approvals: restrict approver UPDATE to safe columns only.
DROP POLICY IF EXISTS "Approvers update approvals" ON public.approvals;

CREATE OR REPLACE FUNCTION public.approvals_update_safe(
  _old public.approvals,
  _new public.approvals
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    _new.id IS NOT DISTINCT FROM _old.id
    AND _new.run_id IS NOT DISTINCT FROM _old.run_id
    AND _new.requester_id IS NOT DISTINCT FROM _old.requester_id
    AND _new.created_at IS NOT DISTINCT FROM _old.created_at
$$;

CREATE POLICY "Approvers update approvals decision only"
ON public.approvals
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'approver'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  (has_role(auth.uid(), 'approver'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND public.approvals_update_safe(approvals, approvals)
);

-- Note: Postgres RLS WITH CHECK only sees the NEW row, so column-level
-- protection of immutable fields is enforced via a trigger below.

CREATE OR REPLACE FUNCTION public.approvals_guard_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.run_id IS DISTINCT FROM OLD.run_id
     OR NEW.requester_id IS DISTINCT FROM OLD.requester_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'approvals: cannot modify id/run_id/requester_id/created_at';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approvals_guard_immutable_trg ON public.approvals;
CREATE TRIGGER approvals_guard_immutable_trg
BEFORE UPDATE ON public.approvals
FOR EACH ROW EXECUTE FUNCTION public.approvals_guard_immutable();

-- dept_model_providers: restrict SELECT to dept admins / global admins.
DROP POLICY IF EXISTS "dept members can read providers" ON public.dept_model_providers;

CREATE POLICY "dept admins read providers"
ON public.dept_model_providers
FOR SELECT
TO authenticated
USING (
  is_dept_admin(auth.uid(), department)
  OR has_role(auth.uid(), 'admin'::app_role)
);