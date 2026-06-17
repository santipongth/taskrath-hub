create table public.user_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

grant select, insert, update, delete on public.user_memory to authenticated;
grant all on public.user_memory to service_role;

alter table public.user_memory enable row level security;

create policy "Users select own memory" on public.user_memory for select to authenticated using (user_id = auth.uid());
create policy "Users insert own memory" on public.user_memory for insert to authenticated with check (user_id = auth.uid());
create policy "Users update own memory" on public.user_memory for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users delete own memory" on public.user_memory for delete to authenticated using (user_id = auth.uid());

create index user_memory_user_idx on public.user_memory(user_id, updated_at desc);

create or replace function public.touch_user_memory_updated_at()
returns trigger language plpgsql
set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

create trigger user_memory_touch_updated
  before update on public.user_memory
  for each row execute function public.touch_user_memory_updated_at();