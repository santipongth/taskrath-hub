-- 1) signed_documents: remove broad anon SELECT; expose only single-row verify via SECURITY DEFINER RPC
drop policy if exists "Public can verify signatures" on public.signed_documents;
revoke select on public.signed_documents from anon;

create or replace function public.verify_signed_document(p_id uuid)
returns table (
  id uuid,
  signer_name text,
  signer_position text,
  agency_name text,
  document_subject text,
  ref_no text,
  content_hash text,
  signed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.signer_name, s.signer_position, s.agency_name,
         s.document_subject, s.ref_no, s.content_hash, s.signed_at
  from public.signed_documents s
  where s.id = p_id
  limit 1;
$$;

revoke all on function public.verify_signed_document(uuid) from public;
grant execute on function public.verify_signed_document(uuid) to anon, authenticated;

-- 2) audit_logs: remove client-side INSERT to prevent forged entries
drop policy if exists "Users insert own audit logs" on public.audit_logs;
revoke insert on public.audit_logs from anon, authenticated;

-- 3) Lock down internal trigger functions
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;