# TaskRath — Tier 2 → Tier 4 Roadmap

แผนนี้แบ่งเป็น 4 phase ตามลำดับความสำคัญและการพึ่งพา (Tier 2 ก่อน เพราะเป็นฐานของ Tier 3–4)

---

## Phase 1 — Tier 2: Productivity (ฐานข้อมูล + Admin)

### 1.1 Template versioning + Admin editor
- ตาราง `templates` (id, slug, name_th, name_en, category, fields jsonb, is_active, created_by) และ `template_versions` (id, template_id, version, system_prompt, user_prompt_template, created_by, created_at, is_published)
- RLS: ทุกคน read templates ที่ active, เฉพาะ admin เขียน/แก้
- ย้าย `TEMPLATE_PROMPTS` จาก `src/lib/ai.functions.ts` → ดึงจาก DB (version ล่าสุดที่ `is_published`)
- หน้า `/admin/templates` — list, edit, preview, publish version
- เพิ่ม route `_authenticated/admin/*` ที่ guard ด้วย `has_role(admin)`

### 1.2 File upload + OCR (Gemini Vision)
- Storage bucket `uploads` (private), RLS: user เข้าถึงไฟล์ตนเอง (folder = user_id)
- Component upload (drag/drop) ใน Run page → ส่งไฟล์ผ่าน server fn `extractTextFromImage`
- Server fn: ใช้ `google/gemini-2.5-flash` (multimodal) ส่งรูป + prompt "ถอดข้อความจากภาพหนังสือราชการ คงรูปแบบ"
- ข้อความที่ได้ inject เข้าช่อง input ของ template

---

## Phase 2 — Tier 3: Governance / Enterprise

### 2.1 PII redaction (pre-AI)
- `src/lib/pii.ts` — regex สำหรับ:
  - เลขบัตร ปชช. 13 หลัก (พร้อม checksum)
  - เบอร์โทร (0x-xxxx-xxxx, +66)
  - อีเมล
  - เลขบัญชีธนาคาร 10–14 หลัก
- ก่อนเรียก `callAI` → replace ด้วย `[ID_1]`, `[PHONE_1]`, ... และเก็บ mapping
- หลัง AI ตอบกลับ → restore กลับ (option toggle per user ใน Settings: "ปกปิด PII ตลอดเวลา")
- บันทึกใน `audit_logs` ว่ามี PII กี่รายการ (ไม่บันทึกค่าจริง)

### 2.2 Prompt injection guard
- `src/lib/prompt-guard.ts` — pattern เสี่ยง: "ignore previous", "system prompt", "ละเว้นคำสั่ง", "DAN", role-switching, markdown injection
- คะแนนความเสี่ยง 0–100; > 70 บล็อก, 40–70 เตือน + log
- ใส่ใน `runTemplate` / `runFreeform`

### 2.3 Usage dashboard (admin)
- ขยาย `ai_runs`: เพิ่มคอลัมน์ `prompt_tokens`, `completion_tokens`, `cost_usd` (อ่านจาก response `usage`)
- หน้า `/admin/usage`: chart (recharts) tokens/วัน, top 10 users, top templates, cost รวม
- View ใช้ SQL aggregates (group by user_id, template_id, date_trunc)

### 2.4 Data retention
- ตั้ง `profiles.retention_days` (default 365) ระดับ workspace (หรือ system setting)
- pg_cron daily: `DELETE FROM ai_runs WHERE created_at < now() - interval '<N> days'`
- หน้า Settings (admin): กำหนด N + ปุ่ม "ลบทันที"

### 2.5 Audit log viewer
- เพิ่ม logging ทุก action สำคัญ: run, approval request/decide, template edit, settings change, file upload
- หน้า `/governance` (admin tab): ตาราง filter by action/user/date, export CSV
- รองรับ infinite scroll หรือ pagination

---

## Phase 3 — Tier 4 (light): Multi-step + RAG

### 3.1 Multi-step agents (chain templates)
- ตาราง `agent_workflows` (id, name, steps jsonb) — แต่ละ step: {template_id, input_mapping}
- Output ของ step N → input ของ step N+1 (ผ่าน Jinja-like `{{step1.output}}`)
- หน้า `/agents` — สร้าง/แก้ workflow, รัน
- เริ่มจาก preset 2–3 ตัว: "สรุปประชุม → ร่างหนังสือเชิญครั้งถัดไป", "วิเคราะห์งบ → ร่างบันทึกเสนอ"

### 3.2 Knowledge base / RAG
- ตาราง `kb_documents` (id, title, source_url, file_path) + `kb_chunks` (id, doc_id, content, embedding vector(3072), metadata)
- เปิด `pgvector`, สร้าง HNSW index
- Server fn `ingestDocument`: parse (pdf/docx) → chunk 800 chars overlap 100 → embed (Lovable AI `google/gemini-embedding-001`) → insert
- Server fn `searchKB`: embed query → cosine search top-5
- Run page: toggle "อ้างอิงระเบียบ" → ดึง chunk ใส่ context พร้อม citation
- หน้า `/admin/knowledge` — อัปโหลด/ลบเอกสาร

---

## Phase 4 — Tier 4 (advanced): Voice + PWA

### 4.1 Voice input
- ใช้ Web Speech API (`SpeechRecognition`) — th-TH
- ปุ่มไมค์ในทุกช่อง textarea → แปลงเสียงเป็นข้อความ
- Fallback: ปุ่ม "อัดไฟล์" → ส่งให้ Gemini audio model ถอดเสียง

### 4.2 Mobile PWA + Push notifications
- `vite-plugin-pwa` — manifest, service worker, offline shell
- Icons ทุกขนาด (สร้างด้วย imagegen)
- Web Push (VAPID): ตาราง `push_subscriptions`
- pg_cron / server fn: เมื่อมี approval request → push ถึง approver
- หน้า Settings: enable/disable push, ทดสอบส่ง

---

## ลำดับการทำ (แนะนำ)

ทำทีละ phase, ส่งมอบ + ทดสอบ end-to-end ก่อนเริ่ม phase ถัดไป:

```text
Phase 1 (Tier 2)  → 2 messages  [templates DB+admin, file upload+OCR]
Phase 2 (Tier 3)  → 3 messages  [PII+injection, usage dashboard, retention+audit viewer]
Phase 3 (Tier 4a) → 2 messages  [agents, RAG]
Phase 4 (Tier 4b) → 2 messages  [voice, PWA+push]
```

## คำถามก่อนเริ่ม

1. **เริ่มจาก Phase ไหน?** แนะนำ Phase 1 (Template versioning + File OCR) เพราะปลดล็อก admin workflow และเป็นฐานของ Phase 2–3
2. **ขอบเขต admin**: ผู้ใช้ปัจจุบันคนไหนเป็น admin? (ต้อง assign `admin` role ใน `user_roles` ให้ก่อน)
3. **Multi-tenant?** ตอนนี้ทุก user เห็น approval รวมกัน — ต้องการแยก workspace/department ไหม? (จะกระทบ schema design ใน Phase 2–3)

ตอบมาแล้วจะลงมือทำ Phase ที่เลือกทันที
