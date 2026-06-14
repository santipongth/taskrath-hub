# 15 — Coding Conventions

## File Layout
- Components: `src/components/<kebab-case>.tsx`
- shadcn ui: `src/components/ui/` (อย่าแก้ตรง ๆ ถ้าไม่จำเป็น)
- Server functions: `src/lib/<feature>.functions.ts`
- Pure utilities: `src/lib/<name>.ts`
- Routes: `src/routes/.../<name>.tsx` (file-based)
- Hooks: `src/hooks/<name>.ts`

## Naming
- Component: PascalCase (`ExportDialog`)
- Function/var: camelCase
- Type: PascalCase, prefix `T` ห้ามใช้ (ใช้ชื่อตรง ๆ — `User`, `Citation`)
- Constants: UPPER_SNAKE_CASE
- DB columns: snake_case
- Slug/id: kebab-case (`meeting-summary`)

## Server Function Pattern (ห้ามแปลงรูป)
```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const myAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    name: z.string().min(1).max(200),
    count: z.number().int().min(0).max(1000),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // ... use supabase (RLS as user)
    // หากต้อง admin: await assertAdmin(...); then await import("../client.server")
    return { ok: true };
  });
```
**ลำดับ chain ต้องเป๊ะ**: `createServerFn → .middleware → .inputValidator → .handler`

## Zod Input Validation
- บังคับใส่ `.min()`, `.max()` ทุก string/number
- ใช้ `.regex()` กับ id/slug/safe-name
- `.parse()` ใน `inputValidator` — ห้าม cast แบบ unsafe

## Import Rules
- เส้นทางสัมพัทธ์: `@/` = `src/`
- ห้าม import `@/integrations/supabase/client.server` ใน:
  - Component / route file (top-level)
  - `*.functions.ts` (top-level) — ใช้ `await import(...)` ใน handler เท่านั้น
- ห้าม import `localStorage`, `window` ใน module ที่ run ฝั่ง server
- ห้าม `process.env.*` ที่ module scope ของไฟล์ shared

## React Patterns
- Default = TanStack Query + `useSuspenseQuery` ใน component, `ensureQueryData` ใน loader
- ห้าม `useEffect` + `fetch` สำหรับ initial fetch
- error boundary: ทุก route ที่มี loader → `errorComponent` + `notFoundComponent`
- forms: react-hook-form + zod
- async button: `disabled` + spinner

## CSS / Tailwind
- ใช้ semantic token (`bg-primary`, `text-foreground`) — ห้ามสีดิบ
- ห้ามเขียน `style={{ ... }}` ที่ตั้งสี/font (ใช้ utility class)
- responsive: mobile first (default → `md:` → `lg:`)
- spacing: ใช้ `gap-*`, `space-y-*` แทน margin บนลูก

## Error Handling
- serverFn throw `Error` → จะถูก serialize ส่งกลับ client เป็น error envelope
- client: `try { await fn(...) } catch (e) { toast.error(e.message) }`
- error message เป็น user-friendly (TH/EN), ไม่ leak stack/SQL

## Logging
- `console.error` เฉพาะ unexpected error
- ห้าม log raw user content / PII / secret
- audit log → `audit_logs` table (metadata jsonb)

## Performance
- pagination ทุก list query (`.limit()`)
- streaming สำหรับ AI text response
- `defaultPreloadStaleTime: 0` (อยู่แล้ว) — query refetch on nav
- avoid blocking computation ใน render — useMemo สำหรับ derived data

## Testing (เมื่อจะเพิ่ม)
- ใช้ `bunx vitest run`
- เน้น util functions (pii, prompt-guard, export)
- mock fetch สำหรับ AI gateway

## Don'ts
- ❌ ห้ามแก้: `routeTree.gen.ts`, `integrations/supabase/{client,client.server,auth-middleware,auth-attacher,types}.ts`, `.env` (VITE_SUPABASE_*), `supabase/config.toml`
- ❌ ห้ามแก้ migration เก่า — สร้างไฟล์ใหม่เสมอ
- ❌ ห้าม `console.log` ใน production code
- ❌ ห้าม `any` (มีไม่กี่จุดที่จำเป็น — ใส่ `// eslint-disable-next-line` + เหตุผล)
- ❌ ห้าม `// @ts-ignore` แบบไม่มีคำอธิบาย
