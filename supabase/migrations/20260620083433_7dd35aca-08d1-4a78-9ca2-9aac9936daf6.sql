
-- 1) Restrict app_settings SELECT to admins only
DROP POLICY IF EXISTS "Authenticated read settings" ON public.app_settings;
CREATE POLICY "Admins read settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Harden approvals_update_safe: set search_path + restrict approver_id
CREATE OR REPLACE FUNCTION public.approvals_update_safe(
  _old public.approvals,
  _new public.approvals
) RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    _new.id IS NOT DISTINCT FROM _old.id
    AND _new.run_id IS NOT DISTINCT FROM _old.run_id
    AND _new.requester_id IS NOT DISTINCT FROM _old.requester_id
    AND _new.created_at IS NOT DISTINCT FROM _old.created_at
    AND (_new.approver_id IS NULL OR _new.approver_id = auth.uid()
         OR public.has_role(auth.uid(), 'admin'::app_role))
    AND (_new.status IS NULL OR _new.status IN ('pending','approved','rejected'))
$$;

-- 3) Trigger-level enforcement (RLS WITH CHECK can't see OLD row).
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

  -- Approvers can only record decisions as themselves; admins may override.
  IF NEW.approver_id IS DISTINCT FROM OLD.approver_id
     AND NEW.approver_id IS NOT NULL
     AND NEW.approver_id <> auth.uid()
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'approvals: approver_id must match the acting user';
  END IF;

  IF NEW.status IS NOT NULL
     AND NEW.status NOT IN ('pending','approved','rejected') THEN
    RAISE EXCEPTION 'approvals: invalid status value';
  END IF;

  RETURN NEW;
END;
$$;
