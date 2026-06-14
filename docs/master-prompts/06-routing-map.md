# 06 — Routing Map

## กฎพื้นฐาน
- File-based: `src/routes/<filename>.tsx` → URL ตาม convention TanStack
- ห้ามแก้ `src/routeTree.gen.ts` (plugin gen ให้)
- ทุก `createFileRoute("...")` ต้องตรงกับ generated route id เป๊ะ ๆ
- ทุก route ที่มี loader ควรมี `errorComponent` + `notFoundComponent`

## Public Routes (ไม่ต้องล็อกอิน)

| Route | ไฟล์ | หน้าที่ |
|---|---|---|
| `/login` | `routes/login.tsx` | sign in (email + Google) |
| `/reset-password` | `routes/reset-password.tsx` | reset flow |
| `/verify/$id` | `routes/verify.$id.tsx` | ตรวจสอบลายเซ็นจาก QR (อ่าน `signed_documents` ผ่าน RLS anon SELECT) |
| `/sitemap.xml` | `routes/sitemap[.]xml.tsx` | sitemap |

## Authenticated Routes (`_authenticated/`)

| Route | ไฟล์ | หน้าที่ |
|---|---|---|
| `/` | `_authenticated/index.tsx` | Dashboard: greeting + stats + quick templates |
| `/run` | `_authenticated/run/index.tsx` | Freeform AI run |
| `/run/$templateId` | `_authenticated/run/$templateId.tsx` | Run จากเทมเพลต (รวม custom_templates) |
| `/templates` | `_authenticated/templates.tsx` | คลังเทมเพลต + filter category + favorite |
| `/chat` | `_authenticated/chat/index.tsx` | redirect ไป thread ล่าสุด / สร้างใหม่ |
| `/chat/$threadId` | `_authenticated/chat/$threadId.tsx` | chat KB หลายเทิร์น + citations |
| `/history` | `_authenticated/history/index.tsx` | ตารางประวัติ ai_runs |
| `/history/$runId` | `_authenticated/history/$runId.tsx` | รายละเอียด + ปุ่ม export |
| `/settings` | `_authenticated/settings.tsx` | ตั้งค่าผู้ใช้ (lang, dept, ลายเซ็น) |
| `/governance` | `_authenticated/governance.tsx` | audit log view |
| `/integrations` | `_authenticated/integrations.tsx` | external systems |
| `/agents` | `_authenticated/agents.tsx` | agent/skills |

## Admin Routes (`_authenticated/admin/`) — ต้อง `has_role(admin)`

| Route | ไฟล์ | หน้าที่ |
|---|---|---|
| `/admin/dashboard` | `admin/dashboard.tsx` | exec stats (cost, runs by dept/template/day) |
| `/admin/usage` | `admin/usage.tsx` | usage breakdown |
| `/admin/knowledge` | `admin/knowledge.tsx` | upload KB docs |
| `/admin/templates` | `admin/templates.tsx` | CRUD custom_templates |
| `/admin/settings` | `admin/settings.tsx` | agency settings (ตราครุฑ, signer) |
| `/admin/notifications` | `admin/notifications.tsx` | LINE config |

## API Routes (`src/routes/api/`)
ใช้สำหรับ webhook / public API / streaming endpoint เท่านั้น

ปัจจุบันมี: (ตามที่ปรากฏใน plan ต้นทาง — chat อาจอยู่ใน serverFn streaming)
- ถ้าจะเพิ่ม webhook: ใส่ใต้ `api/public/<name>.ts`, verify signature ก่อน, `await import` `supabaseAdmin` ใน handler

## Layout Routes
- `__root.tsx` — html/head/body shell, auth listener, query/router provider
- `_authenticated.tsx` — auth gate (client-side: `supabase.auth.getUser()` → redirect `/login`)

## Pattern เพิ่ม route ใหม่
```tsx
// src/routes/_authenticated/new-page.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/new-page")({
  head: () => ({ meta: [{ title: "ชื่อหน้า · TaskRath" }] }),
  component: NewPage,
  errorComponent: ({ error, reset }) => <ErrorView error={error} reset={reset} />,
});

function NewPage() {
  /* ... */
}
```

ถ้ามี loader ที่ต้องดึงข้อมูล:
```tsx
loader: async ({ context }) => context.queryClient.ensureQueryData(myQueryOptions),
```
แล้วใน component ใช้ `useSuspenseQuery(myQueryOptions)`
