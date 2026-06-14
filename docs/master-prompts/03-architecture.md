# 03 — Architecture

## Folder Layout
```
src/
├── routes/                         # file-based routing (TanStack)
│   ├── __root.tsx                  # html shell, auth listener, query/router
│   ├── _authenticated.tsx          # layout: gate ด้วย supabase.auth.getUser()
│   ├── _authenticated/
│   │   ├── index.tsx               # / (dashboard)
│   │   ├── run/                    # สั่งงาน AI
│   │   ├── templates.tsx           # คลังเทมเพลต
│   │   ├── chat/                   # ถาม-ตอบ KB
│   │   ├── history/                # ประวัติงาน
│   │   ├── settings.tsx            # ตั้งค่าผู้ใช้ (ลายเซ็น, ภาษา)
│   │   ├── governance.tsx
│   │   ├── integrations.tsx
│   │   ├── agents.tsx
│   │   └── admin/                  # เฉพาะ role=admin
│   │       ├── dashboard.tsx       # executive stats
│   │       ├── knowledge.tsx       # KB upload
│   │       ├── templates.tsx       # custom templates CRUD
│   │       ├── settings.tsx        # agency settings (ตราครุฑ)
│   │       ├── usage.tsx
│   │       └── notifications.tsx
│   ├── login.tsx
│   ├── reset-password.tsx
│   ├── verify.$id.tsx              # public — ตรวจสอบลายเซ็นจาก QR
│   └── sitemap[.]xml.tsx
├── components/
│   ├── ui/                         # shadcn (อย่าแก้ตรง ๆ ถ้าไม่จำเป็น)
│   ├── app-shell.tsx
│   ├── app-sidebar.tsx
│   ├── export-dialog.tsx
│   ├── citations-list.tsx
│   ├── refine-bar.tsx
│   ├── template-card.tsx
│   └── command-palette.tsx
├── lib/
│   ├── *.functions.ts              # createServerFn (client-safe import)
│   ├── ai.functions.ts             # core AI engine
│   ├── chat.functions.ts           # chat threads + messages
│   ├── kb.functions.ts             # embedding + search
│   ├── custom-templates.functions.ts
│   ├── admin.functions.ts
│   ├── favorites.functions.ts
│   ├── notifications.functions.ts
│   ├── signatures.functions.ts
│   ├── templates.ts                # TEMPLATES (hard-coded)
│   ├── template-icons.ts
│   ├── export.ts                   # PDF/DOCX render
│   ├── pdf-fonts.ts                # Thai font base64
│   ├── pii.ts                      # PII redact/restore
│   ├── prompt-guard.ts             # injection heuristic
│   ├── messages.ts                 # i18n keys
│   ├── i18n.tsx                    # provider/hook
│   └── utils.ts
├── integrations/
│   ├── supabase/
│   │   ├── client.ts               # browser client (อย่าแก้)
│   │   ├── client.server.ts        # supabaseAdmin (service role; server-only)
│   │   ├── auth-middleware.ts      # requireSupabaseAuth (อย่าแก้)
│   │   ├── auth-attacher.ts        # attachSupabaseAuth (อย่าแก้)
│   │   └── types.ts                # auto-gen
│   └── lovable/
│       └── index.ts                # OAuth broker
├── router.tsx
├── start.ts                        # createStart + middleware
├── server.ts
└── styles.css                      # Tailwind v4 + tokens
supabase/
└── migrations/                     # SQL migrations (append-only)
```

## Request Flow

### A) UI → Server Function (default)
```
Component
  → useServerFn(myFn) + useQuery
    → POST /_serverFn/.../myFn
       (attachSupabaseAuth adds Bearer token globally)
    → start.ts functionMiddleware: [attachSupabaseAuth]
    → myFn.middleware([requireSupabaseAuth])
       (verify token, inject {supabase, userId, claims})
    → myFn.handler({ data, context })
       → context.supabase.from(...).select(...)  -- RLS as user
       → return data
```

### B) Admin operation (RLS bypass)
```
.handler(async ({ context }) => {
  await assertAdmin(context.supabase, context.userId)   -- via has_role()
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
  // privileged write
})
```

### C) Public webhook / verify page
- Webhook: `src/routes/api/public/...` — verify signature → import `supabaseAdmin` ใน handler
- Verify page (`/verify/$id`): ใช้ browser `supabase` client + RLS `SELECT` anon policy บน `signed_documents`

### D) AI call
```
serverFn.handler
  → redactPII(input)
  → checkPromptInjection(input) → if block: throw
  → (optional) retrieveKbContext({query, k})        -- embed → cosine search
  → fetch("https://ai.gateway.lovable.dev/v1/chat/completions",
          stream: true, model: "google/gemini-2.5-flash")
  → stream → ReadableStream → client
  → onFinish: insert ai_runs + audit_logs + (optional) notify LINE
```

## Import Graph Rules

| ไฟล์ | import ที่ห้าม |
|---|---|
| component / route file | `@/integrations/supabase/client.server` (ถ้าจำเป็นจริงให้ผ่าน serverFn เท่านั้น) |
| `*.functions.ts` (top-level) | `client.server` ที่ module scope — ให้ `await import(...)` ใน handler เท่านั้น |
| browser code | `process.env.*` |
| server code | `localStorage`, `window` |

## Auth Layer
- เก็บ role ใน `public.user_roles` (enum `app_role`: `admin`/`moderator`/`user`)
- เช็คผ่าน `public.has_role(_user_id, _role)` — SECURITY DEFINER
- `requireSupabaseAuth` → inject `{supabase, userId, claims}` ใน context
- `attachSupabaseAuth` (global functionMiddleware ใน `src/start.ts`) — ใส่ Bearer token อัตโนมัติทุก serverFn call

## State / Cache
- `QueryClient` ผ่าน router context (สร้างใหม่ทุก request ใน `getRouter`)
- `defaultPreloadStaleTime: 0`
- Sign-out: invalidate router + clear query cache (ใน `__root.tsx` onAuthStateChange)
