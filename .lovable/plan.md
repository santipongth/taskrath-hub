
# Knowledge Base / RAG — อ้างอิงระเบียบราชการ

ให้ผู้ใช้อัปโหลดเอกสาร (ระเบียบ/หนังสือเวียน/คู่มือ) → ระบบ chunk + embed → เก็บใน pgvector → ทุก Run/Agent ดึง context ที่เกี่ยวข้องมาเสริม prompt พร้อมแสดง citations

## 1. Database (migration)

เปิด `pgvector` และเพิ่ม 2 ตาราง:

- **`kb_documents`** — เอกสารต้นฉบับ
  - `title`, `source` (url/filename), `category` (ระเบียบ/หนังสือเวียน/คู่มือ/อื่นๆ), `uploaded_by`, `status` (processing/ready/failed), `chunk_count`
- **`kb_chunks`** — ชิ้นเนื้อหา + vector
  - `document_id` (FK, on delete cascade), `chunk_index`, `content` (text), `embedding vector(1536)`, `tokens`
  - HNSW index บน `embedding vector_cosine_ops`
- **SQL function** `match_kb_chunks(query_embedding, match_count, similarity_threshold)` คืน chunks ที่ใกล้ที่สุดพร้อม document title

**RLS**:
- `kb_documents`: authenticated อ่านได้ทั้งหมด (knowledge เป็น org-wide), admin เท่านั้นที่ insert/update/delete
- `kb_chunks`: authenticated อ่านได้, admin เท่านั้นที่จัดการ
- Storage bucket `kb-files` (private) — admin upload, authenticated read

## 2. Server functions (`src/lib/kb.functions.ts`)

- `uploadKbDocument({ title, category, fileDataUrl, mimeType })` — admin only
  - บันทึกไฟล์ลง storage, สร้าง row `kb_documents` status=processing
  - แตกข้อความ: PDF/DOCX → ใช้ Lovable AI (Gemini) อ่านเอกสารเป็น text; TXT/MD → อ่านตรง
  - Chunk ~800 ตัวอักษร overlap 100
  - เรียก Lovable AI Embeddings (`openai/text-embedding-3-small`, dim 1536) batch ละ 64 chunks
  - Insert `kb_chunks` ทั้งหมด, อัปเดต status=ready, chunk_count
- `listKbDocuments()` — รายการเอกสาร + chunk count
- `deleteKbDocument({ id })` — admin (cascade ลบ chunks + storage object)
- `reindexKbDocument({ id })` — admin
- `searchKb({ query, topK=5 })` — embed query → rpc `match_kb_chunks` → คืน `[{content, title, source, similarity}]`

## 3. ผูก RAG เข้ากับ Run/Agent

แก้ `src/lib/ai.functions.ts`:

- เพิ่ม helper `retrieveContext(query, opts)` คืน chunks + citations text block
- `runTemplate`, `runFreeform`, `runAgent`, `refineRun`:
  - ถ้า `app_settings.kb_enabled = true` (default true): สร้าง query จาก inputs → `searchKb` top 5 (threshold 0.5)
  - แทรกเป็น `<ระเบียบที่เกี่ยวข้อง>...</ระเบียบที่เกี่ยวข้อง>` ใน system prompt + สั่งให้ AI อ้างอิงด้วย `[หมายเลข]`
  - บันทึก `metadata.citations = [{index, title, source, similarity}]` ใน `ai_runs`

## 4. UI

- **หน้าใหม่ `/admin/knowledge`** (admin only, เพิ่มใน sidebar)
  - ปุ่ม Upload (drag-drop, รองรับ PDF/DOCX/TXT/MD ≤10MB)
  - ตารางเอกสาร: title, category, status badge, chunks, uploaded_at, actions (re-index, delete)
  - Search box ทดสอบ RAG (พิมพ์คำถาม → แสดง top chunks + similarity)
- **Run / History / Agent result**: ถ้ามี citations แสดง section "อ้างอิง" ใต้ output — chip คลิกได้แสดง popover เนื้อหา chunk ต้นทาง
- **Admin Settings**: toggle "เปิดใช้ Knowledge Base กับทุก Run"

## 5. Audit

ทุก upload/delete/reindex เขียน `audit_logs` action `kb.upload|kb.delete|kb.reindex`

## Technical notes

- ใช้ Lovable AI Gateway สำหรับ embeddings (มี LOVABLE_API_KEY อยู่แล้ว) — ไม่ต้องขอ secret ใหม่
- PDF/DOCX text extraction: ส่ง dataUrl เข้า `google/gemini-2.5-flash` พร้อม prompt "ดึงข้อความทั้งหมดออกมา preserve โครงสร้าง" (ใช้ pattern เดียวกับ `extractTextFromImage` ที่มีอยู่)
- pgvector(1536) เลือกเพราะถูกกว่า + เร็วกว่า, คุณภาพพอใช้สำหรับเอกสารภาษาไทย
- Chunking: split ที่ขอบประโยค/ย่อหน้า ภาษาไทย (split ด้วย `\n\n` ก่อน, fallback ตัวอักษร)

## Out of scope (รอบนี้)

- Re-ranking, hybrid full-text search
- ผู้ใช้ทั่วไป upload เอกสารส่วนตัว (ตอนนี้เฉพาะ admin = องค์กร)
- Cron auto-reindex
