# 07 — Database Schema

> ทุก migration อยู่ใน `supabase/migrations/` (append-only, ห้ามแก้ไฟล์เก่า)

## ตารางทั้งหมด (13)

| ตาราง | หน้าที่ |
|---|---|
| `profiles` | โปรไฟล์ผู้ใช้ (display_name, department, signature_data_url, signer_position) |
| `user_roles` | role ของผู้ใช้ (enum `app_role`) |
| `app_settings` | key-value JSON (`agency`, `notifications`) |
| `ai_runs` | log การเรียก AI (template, status, tokens, cost, needs_approval) |
| `audit_logs` | audit trail ของ admin/system action |
| `approvals` | คิวอนุมัติเอกสาร |
| `kb_documents` | เอกสาร KB (title, source, category, status) |
| `kb_chunks` | chunk + embedding (vector 1536) |
| `chat_threads` | session chat ของผู้ใช้ |
| `chat_messages` | message ใน thread (role, content, citations jsonb) |
| `custom_templates` | template ที่ admin สร้างเอง (slug, fields jsonb, system_prompt) |
| `template_favorites` | favorite ของผู้ใช้ |
| `signed_documents` | ลายเซ็นดิจิทัล (content_hash, signer info) — มี anon SELECT |

## Role System (ห้ามเก็บ role ใน profiles!)

```sql
create type public.app_role as enum ('admin','moderator','user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

-- SECURITY DEFINER เพื่อใช้ใน RLS ของตารางอื่น (ป้องกัน recursion)
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
```

## Pattern มาตรฐานเมื่อสร้างตารางใหม่

```sql
-- 1) CREATE TABLE
create table public.my_table (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ...,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) GRANT (เลือกตาม policy ของคุณ)
grant select, insert, update, delete on public.my_table to authenticated;
grant all on public.my_table to service_role;
-- grant select on public.my_table to anon;  -- เฉพาะถ้ามี policy อนุญาต anon

-- 3) ENABLE RLS
alter table public.my_table enable row level security;

-- 4) POLICIES
create policy "owners can read" on public.my_table
  for select to authenticated using (auth.uid() = user_id);

create policy "owners can write" on public.my_table
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- (optional) admins can read all
create policy "admins read all" on public.my_table
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- 5) updated_at trigger
create trigger trg_my_table_updated_at
  before update on public.my_table
  for each row execute function public.update_updated_at_column();
```

## Special: `signed_documents`
มี anon SELECT policy เพื่อให้หน้า `/verify/$id` (ไม่ต้อง login) อ่านได้
```sql
grant select on public.signed_documents to anon;
create policy "public can verify" on public.signed_documents
  for select to anon using (true);
```

## Storage Buckets
- `agency-assets` (private) — เก็บตราครุฑ, asset ของหน่วยงาน
  - read ผ่าน signed URL จาก server function เท่านั้น
- (อาจมีอื่น ๆ — ตรวจกับ Supabase ก่อนใช้)

## หลีกเลี่ยง
- `auth`, `storage`, `realtime`, `supabase_functions`, `vault` schemas — ห้ามแตะ
- การเก็บ role ใน `profiles.role` (privilege escalation risk)
- การลืม GRANT — PostgREST จะ permission error
- `update` policy ที่ไม่มี `with check`
