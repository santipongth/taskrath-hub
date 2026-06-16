create or replace function public.log_audit(
  p_action text,
  p_resource text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'log_audit requires an authenticated caller';
  end if;
  insert into public.audit_logs (user_id, action, resource, metadata)
  values (auth.uid(), p_action, p_resource, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on function public.log_audit(text, text, jsonb) from public;
grant execute on function public.log_audit(text, text, jsonb) to authenticated;