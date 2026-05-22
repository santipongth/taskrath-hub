
## ภาพรวม
แบ่งงานเป็น 4 เฟส เรียงตามผลกระทบและความง่ายในการส่งมอบ ทุกเฟสเป็น frontend + serverFn บนสแตคเดิม (TanStack Start + Lovable Cloud) ไม่ใช้ Edge Function

---

## Phase 1 — Productivity (เริ่มก่อน, impact สูง)

### 1.1 Favorites / Pinned templates
- Migration: ตาราง `template_favorites (user_id, template_id, created_at)` + RLS เจ้าของเท่านั้น
- ServerFn: `listFavorites`, `toggleFavorite`
- UI: ปุ่มดาว ★ บน `TemplateCard`, section "ปักหมุด" บน Dashboard (`_authenticated/index.tsx`) แสดงก่อน Quick Actions

### 1.2 Export PDF + DOCX
- หน้า `history/$runId.tsx` + ปุ่มในแถวรายการ `history/index.tsx`
- ใช้ client-side: `jspdf` + `html2canvas` สำหรับ PDF (ฟอนต์ Sarabun embed), `docx` package สำหรับ DOCX
- หัวกระดาษราชการ: ตราครุฑ (asset), ชื่อหน่วยงาน, ที่/วันที่, เนื้อหา, ลงนาม — render จาก `ai_runs.output`
- ปุ่ม "Export PDF" / "Export DOCX" ที่หน้าผลลัพธ์ run และเมนู ⋯ ในตาราง history

### 1.3 เทมเพลตใหม่
เพิ่มใน `src/lib/templates.ts`:
- `dopa-verify` — ตรวจสอบเอกสาร DOPA (ทะเบียนราษฎร, บัตร ปชช.) — ฟิลด์: ประเภทเอกสาร, ข้อความ/รูปจาก OCR → ตรวจความครบถ้วนและจุดผิดปกติ
- `complaint-classify` — จำแนก+ร่างตอบข้อร้องเรียนประชาชน (มี `complaint-reply` แล้ว เสริมตัวจำแนกประเภท/หน่วยงานที่เกี่ยวข้อง/ระดับความเร่งด่วน)

หมายเหตุ: Template Library "หนังสือราชการมาตรฐาน/แบบฟอร์ม DOPA/e-Gov" ส่วนใหญ่ครอบคลุมใน 14 เทมเพลตเดิม + 2 ตัวใหม่นี้ ถ้าต้องการเพิ่มชุดเต็มภายหลังค่อยทำผ่าน Admin Template Editor (อยู่ใน backlog Tier 2 เดิม)

---

## Phase 2 — Executive Dashboard
ขยายจาก `/admin/usage` เป็น `/admin/dashboard` สำหรับผู้บริหาร:
- ServerFn `executiveStats` (admin only): runs ตามแผนก (join `profiles.department`), top templates, แนวโน้มรายสัปดาห์/เดือน, อัตราการ approve/reject, จำนวนผู้ใช้ active
- กราฟ: bar (runs by department), pie (template mix), line (trend 90 วัน)
- ฟิลเตอร์ช่วงเวลา + export CSV
- การ์ด KPI: total runs, total cost, avg cost/run, pending approvals

---

## Phase 3 — Notification

### 3.1 Email (ใช้ Lovable Cloud emails)
- เปิด email infra → ส่งเมื่อ: มี approval รออนุมัติ (ส่งหา approver), approval ถูกตัดสิน (ส่งหา requester)
- ServerFn `sendApprovalEmail` เรียกใน flow approval ปัจจุบัน

### 3.2 LINE Notify / LINE OA
- LINE Notify ถูก deprecate มี.ค. 2025 → ใช้ LINE Messaging API (LINE OA)
- ต้องการ secret: `LINE_CHANNEL_ACCESS_TOKEN`
- ตาราง `line_bindings (user_id, line_user_id)` ให้ผู้ใช้ผูกบัญชีผ่าน LINE Login (เฟสนี้เริ่มแค่ broadcast group ก่อน — ผู้ดูแลกรอก group ID)
- ServerFn `sendLineNotification(text)` push ไปยัง group ที่ตั้งค่าใน `app_settings`
- ตั้งค่า: หน้า Settings → "การแจ้งเตือน LINE" (toggle + group ID)

---

## Phase 4 — Backlog (รอยืนยัน)
- RAG (อ้างอิงระเบียบราชการ), Multi-step agents, Voice input, PWA — จากแผนเดิม

---

## รายละเอียดเทคนิค

**Database migrations**
```sql
CREATE TABLE template_favorites (
  id uuid PK, user_id uuid, template_id text,
  created_at timestamptz, UNIQUE(user_id, template_id)
);
-- RLS: เจ้าของอ่าน/เขียนของตน

CREATE TABLE line_bindings (id, user_id unique, line_user_id, created_at);
CREATE TABLE app_settings (key text PK, value jsonb); -- เก็บ LINE group ID, email toggles
```

**Packages**
- `bun add jspdf html2canvas docx` (สำหรับ export)
- ฟอนต์ Sarabun: ใช้ TTF จาก Google Fonts → embed base64 ใน jspdf

**ไฟล์ใหม่/แก้**
- `src/lib/export.ts` — `exportRunToPdf`, `exportRunToDocx`
- `src/lib/favorites.functions.ts`
- `src/lib/notifications.functions.ts` (email + line)
- `src/lib/admin.functions.ts` — เพิ่ม `executiveStats`
- `src/routes/_authenticated/admin/dashboard.tsx`
- `src/routes/_authenticated/history/$runId.tsx` — เพิ่มปุ่ม Export
- `src/components/template-card.tsx` — เพิ่ม favorite toggle
- `src/routes/_authenticated/index.tsx` — section pinned
- `src/lib/templates.ts` — เพิ่ม 2 เทมเพลต

**Secrets ที่ต้องเพิ่ม (เฟส 3)**: `LINE_CHANNEL_ACCESS_TOKEN`

---

## คำถามก่อนเริ่ม
1. เริ่ม Phase 1 ทั้งก้อน (Favorites + Export PDF/DOCX + 2 เทมเพลตใหม่) เลยใช่ไหม? หรืออยากเลือกเฉพาะส่วน?
2. Export PDF: ต้องมีตราครุฑ + ชื่อหน่วยงานบนหัวกระดาษไหม? ถ้าใช่ ขอชื่อหน่วยงาน/โลโก้
3. Notification เฟส 3: เริ่มที่ Email อย่างเดียว หรือทำ LINE OA ด้วย? (LINE ต้องมี Channel Access Token จาก LINE Developers Console)
