# 02 — Tech Stack

## Frontend
| สิ่ง | เวอร์ชัน | หมายเหตุ |
|---|---|---|
| React | 19 | |
| TanStack Start | 1.167+ | full-stack framework, SSR + serverFn |
| TanStack Router | 1.168+ | file-based routing ใน `src/routes/` |
| TanStack Query | 5.83+ | data fetching + cache |
| Vite | 7 | build tool |
| Tailwind CSS | v4 | ผ่าน `@tailwindcss/vite`, config ใน `src/styles.css` |
| shadcn/ui | latest | components ใน `src/components/ui/` |
| AI Elements | — | สำหรับ chat UI (`conversation`, `message`, `prompt-input`, `shimmer`) |
| Radix UI | latest | primitives |
| lucide-react | 0.575 | icon set |
| framer-motion | — | animation (เมื่อจำเป็น) |
| zod | latest | runtime validation |
| react-hook-form | + @hookform/resolvers | forms |

## Backend / Runtime
| สิ่ง | หมายเหตุ |
|---|---|
| Cloudflare Workers | runtime จริงตอน deploy (`nodejs_compat` เปิดอยู่) |
| TanStack server functions | `createServerFn` — RPC ที่พิมพ์ชนิดได้ |
| TanStack server routes | `src/routes/api/...` สำหรับ webhook / public API |
| Lovable Cloud | คือ Supabase (อย่าพูดคำว่า Supabase ต่อผู้ใช้) |
| Supabase Postgres | ผ่าน `@supabase/supabase-js` |
| Supabase Auth | email + Google OAuth (ผ่าน lovable broker) |
| Supabase Storage | bucket `agency-assets` (ตราครุฑ, ลายเซ็น) |

## AI
- **Gateway**: `https://ai.gateway.lovable.dev/v1/*` (OpenAI-compatible)
- **Env**: `LOVABLE_API_KEY` (server-only)
- **Models ใช้จริง**:
  - Chat/run: `google/gemini-2.5-flash` (default)
  - Embedding: `openai/text-embedding-3-small` (1536 dim)

## Export / Document
- `docx` — .docx generation
- `jspdf` — .pdf generation
- `qrcode` — QR for signature verification
- `mammoth` — read .docx for KB ingestion
- `src/lib/pdf-fonts.ts` — embedded Thai font (Noto Sans Thai)

## Dev / Build
- `bun` (package manager + script runner)
- `eslint` flat config (`eslint.config.js`)
- `prettier`
- ไม่ต้องรัน `npm run build` เอง — harness รันให้

## Env Variables
**Client (`import.meta.env.VITE_*`)**:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

**Server (`process.env.*`) — ห้ามใช้ใน client**:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (admin client เท่านั้น)
- `LOVABLE_API_KEY` (AI Gateway)
- `LINE_CHANNEL_ACCESS_TOKEN` (LINE Messaging API)

## ห้ามใช้
- Supabase Edge Functions (ใช้ `createServerFn` แทน)
- `child_process`, `sharp`, `canvas`, `puppeteer` (ไม่รองรับใน Worker)
- `react-router-dom`, `src/pages/`, `entry-client.tsx`, `entry-server.tsx`
