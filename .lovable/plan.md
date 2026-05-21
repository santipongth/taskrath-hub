## Continue TaskRath — wire up routes & pages

Foundation (DB, auth config, design tokens, i18n, templates registry, AI server functions, AppShell, Sidebar) is already in place. Now build the navigable surface.

### 1. Router bootstrap
- Update `src/routes/__root.tsx`: add `I18nProvider`, Google Fonts (Inter + Noto Sans Thai), `onAuthStateChange` listener that invalidates router + query cache, Sonner toaster.
- Wrap router context with `QueryClientProvider` in `src/router.tsx`.

### 2. Public routes
- `src/routes/login.tsx` — email/password + Google (via `lovable.auth.signInWithOAuth`) + link to reset. Redirect to `/` on success.
- `src/routes/reset-password.tsx` — handles `type=recovery`, calls `supabase.auth.updateUser({ password })`.

### 3. Auth guard layout
- `src/routes/_authenticated.tsx` — `beforeLoad` checks `supabase.auth.getUser()`, redirects to `/login` if missing. Renders `<AppShell><Outlet /></AppShell>`.

### 4. Authenticated pages
- `_authenticated/index.tsx` — Dashboard: bilingual greeting, stat cards (`runsThisWeek`, `pendingApprovals` via `dashboardStats`), grid of all 14 template cards.
- `_authenticated/run.tsx` — Freeform AI: textarea + Run button → calls `runFreeform`, shows streamed output, copy button.
- `_authenticated/run.$templateId.tsx` — Dynamic form from `templates.ts` fields, calls `runTemplate`, shows result with copy + "Request approval" button.
- `_authenticated/templates.tsx` — full grid with search input + category filter chips.
- `_authenticated/history.tsx` — table of `listHistory()` runs, click row → detail.
- `_authenticated/history.$runId.tsx` — full input/output view, copy/export.
- `_authenticated/agents.tsx` — list of HiClaw agents (stub list for now, "เชื่อมต่อ HiClaw" empty state).
- `_authenticated/integrations.tsx` — placeholder cards (Email, Document Storage, e-Office) with "เร็ว ๆ นี้" badge.
- `_authenticated/approvals.tsx` — table of `listPendingApprovals()`, approve/reject buttons (only visible to `approver`/`admin` roles).
- `_authenticated/governance.tsx` — usage stats + audit log table + data-handling policy text.
- `_authenticated/settings.tsx` — profile (display_name, department), language preference, sign out.

### 5. Move auth-protected fns out of loaders
All protected server functions are called via `useServerFn` + `useQuery` inside components (not loaders) to avoid SSR/prerender 401s.

### 6. Polish
- Loading skeletons on all data views.
- Empty states (bilingual).
- Per-route `head()` titles (TH + EN).
- Toast on errors via Sonner.

### Out of scope (still)
- Real file upload OCR (file picker UI only).
- HiClaw agent live list (uses local stub until `HICLAW_API_URL` is provided).
