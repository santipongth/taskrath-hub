# 04 — Design System

## โทนภาพรวม
- **เป็นทางการ แต่ไม่แข็ง** — เหมาะกับงานราชการ ไม่ใช่ consumer
- **เน้นเนื้อหา** — พื้นหลังขาว/เทาอ่อน ใช้สีเน้นเฉพาะที่จำเป็น
- **ความหนาแน่นกลาง** — text สำคัญต้องอ่านง่าย ไม่บีบ
- **ไม่มี gradient/glow แบบ AI** — เน้น flat + hairline border

## Typography
- **font-sans / font-display**: `"Inter", "Noto Sans Thai", "Prompt", system-ui, sans-serif`
- ใช้ฟอนต์เดียวกันทั้งหัวและเนื้อ — ความเรียบ = ความเป็นทางการ
- น้ำหนัก: 400 (body), 500 (label), 600 (heading), 700 (display)
- ภาษาไทยต้องอ่านได้สบายที่ขนาด 14–16px

## Color Palette (OKLCH — ดู `src/styles.css`)
| Token | Light | ใช้ตอน |
|---|---|---|
| `--background` | `oklch(1 0 0)` ขาวล้วน | พื้นหลังหลัก |
| `--foreground` | slate-900 `oklch(0.205 0.04 257)` | ข้อความ |
| `--surface` | slate-50 | card secondary |
| `--primary` | `~#3B82F6` slate-blue | ปุ่มหลัก, ลิงก์, ring |
| `--primary-foreground` | ขาว | ข้อความบน primary |
| `--primary-muted` | `~#64748B` | สถานะรอง |
| `--muted-foreground` | `~#475569` | text รอง |
| `--border` / `--input` | `#E2E8F0` hairline | เส้นแบ่ง |
| `--destructive` | แดง | ลบ, error |
| `--success` | เขียว | สำเร็จ |
| `--warning` | เหลืองส้ม | คำเตือน |
| `--sidebar` | slate-50 | sidebar bg |

**Dark mode**: มี token ครบเหมือนกัน (`.dark *`) — ดูใน `src/styles.css`

## Semantic Token Rules (สำคัญ)
- ❌ **ห้าม** เขียน `text-white`, `bg-black`, `text-blue-500` ใน component
- ✅ ใช้ token: `text-foreground`, `bg-primary`, `text-primary-foreground`, `border-border`
- ถ้าต้องการสีใหม่ → เพิ่ม token ใน `src/styles.css` ก่อน
- shadcn variants → ปรับผ่าน `class-variance-authority`

## Spacing & Radius
- `--radius: 0.625rem` (10px) เป็นฐาน
- ใช้ Tailwind scale ปกติ (`gap-2`, `p-4`, `space-y-6`)
- Card padding มาตรฐาน: `p-6` (desktop), `p-4` (mobile)

## Motion
- ใช้ framer-motion เฉพาะที่ส่งผลต่อการเข้าใจ (เช่น enter/exit, skeleton → content)
- `transition-colors`, `transition-opacity` ขนาดเล็กพอ — หลีกเลี่ยง scale/blur ฟุ่มเฟือย
- Chat: ใช้ `Shimmer` จาก AI Elements สำหรับสถานะ "กำลังคิด…"

## Iconography
- `lucide-react` เท่านั้น
- ขนาดมาตรฐาน: `h-4 w-4` ใน sidebar/menu, `h-5 w-5` ใน button, `h-6 w-6` ใน hero
- **อย่าใช้ `Sparkles` เป็นโลโก้/identity ของ AI** — ใช้ตัว "T" badge ใน sidebar header แทน (ดู `app-sidebar.tsx`)

## ภาษา & Tone (สำหรับ wording UI)
- ภาษาไทย: สุภาพ-ตรง-สั้น เลี่ยงคำฟุ่มเฟือย ("กรุณา" ใช้เมื่อจำเป็น)
- อังกฤษ: title case ใน button, sentence case ใน description
- คำราชการ: ใช้ตามระเบียบสารบรรณ (เช่น "เรียน", "เรื่อง", "สิ่งที่ส่งมาด้วย")
- รวม wording ทั้งหมดใน `src/lib/messages.ts` — อย่า hard-code

## Accessibility
- contrast ≥ WCAG AA (token ปัจจุบันผ่าน)
- focus ring ใช้ `--ring` (= primary)
- ทุก interactive ต้อง keyboard-accessible (Radix จัดการให้แล้ว)
- `aria-label` กับ icon-only buttons
- รองรับ reduced-motion

## Layout Pattern
- App shell = Sidebar (collapsible) + main content
- Page header: heading + actions ขวา + (optional) description
- Content max-width แบบ form: `max-w-3xl` หรือ `max-w-4xl`
- ใช้ `Card` สำหรับ group เนื้อหา, `Separator` สำหรับแบ่งหัวข้อ

## สิ่งที่ห้ามทำ
- gradient ม่วง/น้ำเงินแบบ generic AI
- emoji ใน UI ทางการ (OK ใน chat empty state)
- ฟอนต์ decorative / cursive
- shadow ใหญ่เกิน (`shadow-2xl`) — ใช้ `shadow-sm` หรือ border แทน
