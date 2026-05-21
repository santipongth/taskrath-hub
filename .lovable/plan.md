## TaskRath (ทาสก์-รัฐ) — Universal Dashboard for Thai Gov Officials

A clean, minimalist bilingual (TH/EN) web app wrapping the HiClaw AI engine. Built on TanStack Start + Lovable Cloud (auth + Postgres + RLS). HiClaw is wired through a server-function abstraction so it can be swapped from mock → real HiClaw API by setting one secret.

---

### 1. Design system

- **Palette** (tokens in `src/styles.css`, oklch):
  - `--background` pure white, `--surface` `#F8FAFC`, `--border` `#E2E8F0`
  - `--primary` muted slate-blue `#3B82F6`, `--primary-muted` `#64748B`
  - `--foreground` `#0F172A`, `--muted-foreground` `#334155`
- **Type**: Inter (Latin) + Noto Sans Thai / Prompt fallback, loaded via Google Fonts link in `__root.tsx`.
- **Style rules**: 1px hairline borders, no heavy shadows (`shadow-sm` only on hover), generous whitespace, rounded-lg, subtle active states (`bg-muted`).
- All components themed via semantic tokens — no raw colors in JSX.

### 2. Layout & navigation

- `src/components/app-shell.tsx`: `SidebarProvider` + `AppSidebar` + top header (logo "TaskRath", search input with hairline border, language toggle TH/EN, user avatar menu).
- `src/components/app-sidebar.tsx`: shadcn sidebar, `collapsible="icon"`, lucide icons, active route highlight via `useRouterState`.
- Sidebar items map to routes:
  - `/` Dashboard (LayoutDashboard)
  - `/run` สั่งงาน AI (Sparkles)
  - `/templates` คลังงานสำเร็จรูป (LibraryBig)
  - `/history` ประวัติการใช้งาน (History)
  - `/agents` Agent & Skills (Bot)
  - `/integrations` เชื่อมระบบ (Plug)
  - `/approvals` อนุมัติ & ประวัติ (CheckCircle2)
  - `/governance` ธรรมาภิบาล (ShieldCheck)
  - `/settings` ตั้งค่า (Settings)

### 3. Routes (TanStack file-based)

Layout route `src/routes/_authenticated.tsx` gates all app routes with `beforeLoad` + Supabase session check, renders `<AppShell><Outlet /></AppShell>`.

Public:
- `/login` — email/password + Google sign-in (via Lovable broker).

Authenticated (`_authenticated/`):
- `index.tsx` — Dashboard: greeting, quick stats (runs this week, drafts pending approval), and Template Library grid.
- `run.tsx` — สั่งงาน AI: free-form prompt + optional template + file context, streams result.
- `run.$templateId.tsx` — Template-specific form with structured inputs (e.g. Meeting Summary takes transcript + attendees + date).
- `templates.tsx` — full grid + search + category filter.
- `history.tsx` — table of past runs, click to view output.
- `history.$runId.tsx` — detail view, copy/export.
- `agents.tsx` — list of HiClaw agents/skills (read from HiClaw or mock).
- `integrations.tsx` — connect external systems (placeholder cards).
- `approvals.tsx` — drafts awaiting supervisor approval; approver can approve/reject.
- `governance.tsx` — usage logs, data-handling policy, audit trail.
- `settings.tsx` — profile, language, notifications.

### 4. Template Library (core feature)

12 cards, each with delicate border, Lucide icon, TH+EN title, short description, `hover:shadow-sm`:

1. สรุปการประชุม / Meeting Summary (FileAudio)
2. ร่างหนังสือภายนอก / External Official Letter (Mail)
3. ร่างหนังสือภายใน / Internal Official Letter (Inbox)
4. บันทึกข้อความ / Memo Draft (StickyNote)
5. วิเคราะห์งบประมาณ / Budget Analysis (Calculator)
6. สรุปเอกสารยาว / Document Summarization (FileText)
7. ร่าง TOR / TOR Draft (FileSignature)
8. ร่างคำสั่งแต่งตั้ง / Appointment Order Draft (Stamp)
9. ร่างประกาศ / Public Announcement Draft (Megaphone)
10. ตอบข้อร้องเรียนประชาชน / Citizen Complaint Reply (MessagesSquare)
11. แปลเอกสารราชการ TH↔EN / Official Translation (Languages)
12. ตรวจร่างเอกสาร & ตรวจคำผิด / Document QA & Proofread (SpellCheck)
13. สรุปกฎหมาย/ระเบียบ / Law & Regulation Summary (Scale)
14. ร่างวาระการประชุม / Meeting Agenda Draft (CalendarClock)

Each template defined in `src/lib/templates.ts` with `id`, `icon`, `titleTh/En`, `descTh/En`, `category`, and `fields[]` schema → renders dynamic form on `/run/$templateId`.

### 5. HiClaw integration layer

- `src/lib/hiclaw.server.ts` — server-only client. Reads `HICLAW_API_URL` and `HICLAW_API_KEY` from `process.env`. If unset → uses a mock that calls Lovable AI Gateway (Gemini) with a templated system prompt so the UI is fully functional today.
- `src/lib/ai.functions.ts` — `createServerFn` exports:
  - `runTemplate({ templateId, inputs })` → streams/returns result, persists to `ai_runs` table.
  - `runFreeform({ prompt, context })`.
  - `listAgents()`, `listSkills()` — proxied from HiClaw.
- Reference: https://github.com/agentscope-ai/hiclaw — exact endpoints checked at implementation time; the abstraction means UI is unblocked regardless.

### 6. Database (Lovable Cloud)

Tables (all with RLS):
- `profiles` (id → auth.users, display_name, department, language_pref, created_at) — auto-created via trigger.
- `user_roles` (separate table, enum `app_role`: `user | approver | admin`) + `has_role()` security-definer function. No roles on profiles.
- `ai_runs` (id, user_id, template_id nullable, input jsonb, output text, status, created_at). RLS: owner can read/write own; approvers can read those flagged for approval.
- `approvals` (id, run_id, requester_id, approver_id nullable, status `pending|approved|rejected`, note, created_at, decided_at). RLS: requester reads own; approvers read pending; admins read all.
- `audit_logs` (id, user_id, action, resource, metadata jsonb, created_at) — append-only for governance page.

### 7. Auth

- Email/password + Google (via `lovable.auth.signInWithOAuth("google")` and `supabase--configure_social_auth`).
- `attachSupabaseAuth` middleware registered in `src/start.ts`.
- `__root.tsx` listens to `onAuthStateChange` → invalidates router + query cache.
- Password reset page at `/reset-password`.

### 8. Bilingual (TH/EN)

- Lightweight `src/lib/i18n.tsx` context with `lang` state persisted to localStorage and `profiles.language_pref`. No heavy i18n library.
- All strings authored as `{ th, en }` pairs in a single `messages.ts`. `t(key)` helper.
- Header toggle: `TH | EN` segmented control.

### 9. Technical notes

- TanStack Start v1, file-based routes only.
- Tailwind v4 via `src/styles.css` (`@theme inline` + oklch tokens).
- shadcn components: sidebar, card, button, input, dialog, dropdown-menu, table, tabs, badge, skeleton, sonner.
- All server-side Supabase access through `requireSupabaseAuth` middleware; `supabaseAdmin` only for audit-log inserts triggered server-side.
- HiClaw key + URL added via secrets tool after first plan approval.
- SEO: per-route `head()` titles in TH+EN.

### 10. Out of scope for v1 (will note in UI)

- Real document upload OCR pipeline (file picker exists, parsing stubbed).
- Multi-tenant org switching.
- Fine-grained per-department RLS beyond the role enum above.

### Build order

1. Enable Lovable Cloud, create DB schema + RLS + trigger.
2. Auth (login, reset, root listener, `_authenticated` guard).
3. Design tokens + AppShell + Sidebar + Header + i18n.
4. Templates registry + Dashboard grid + Template Library page.
5. HiClaw server abstraction (mock via Lovable AI) + `/run` and `/run/$templateId`.
6. History + run detail.
7. Approvals flow + governance/audit page.
8. Agents, Integrations, Settings (functional, lean).
9. Polish, empty states, loading skeletons, SEO heads.
