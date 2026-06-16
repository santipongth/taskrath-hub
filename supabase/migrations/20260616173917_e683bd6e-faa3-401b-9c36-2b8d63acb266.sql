
-- Add SELECT policy on signed_documents
CREATE POLICY "Users read own signatures" ON public.signed_documents
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all signatures" ON public.signed_documents
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Tighten approvals UPDATE policy: add WITH CHECK to prevent tampering with requester_id/approver_id
DROP POLICY IF EXISTS "Approvers update approvals" ON public.approvals;

CREATE POLICY "Approvers update approvals" ON public.approvals
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'approver'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'approver'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));
