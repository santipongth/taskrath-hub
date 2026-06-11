# Multi-turn Chat กับ Knowledge Base

ระบบถาม-ตอบกฎระเบียบแบบสนทนาต่อเนื่อง ใช้เอกสาร KB ที่ admin อัปโหลดไว้ พร้อมแสดง citations ของ chunk ที่ AI ใช้ตอบ

## ตัวเลือกที่เลือกให้ (defaults)
- **รูปแบบ**: หลายห้องสนทนา (threads) — ผู้ใช้สร้าง/ตั้งชื่อ/ลบได้เอง
- **เก็บประวัติ**: ใน Lovable Cloud (database) ผูกกับผู้ใช้ — ใช้งานข้ามอุปกรณ์ได้
- **ขอบเขต KB**: ค้นทั้งหมด + ตัวกรอง category (optional dropdown)
- **โมเดล**: `google/gemini-3-flash-preview` (ผ่าน Lovable AI Gateway, streaming)

## โครงสร้างใหม่

### 1. Database (migration)
- `chat_threads`: `user_id`, `title`, `category_filter` (nullable)
- `chat_messages`: `thread_id`, `role` (user/assistant), `content`, `citations` (jsonb — array ของ `{doc_id, chunk_id, title, score, snippet}`)
- RLS: ผู้ใช้เห็น/แก้เฉพาะของตัวเอง
- GRANT + RLS ครบตามมาตรฐาน

### 2. Routes (TanStack file-based)
- `src/routes/_authenticated/chat/index.tsx` — redirect ไป thread ล่าสุด หรือสร้างใหม่
- `src/routes/_authenticated/chat/$threadId.tsx` — หน้า chat หลัก (thread list ซ้าย + conversation ขวา)
- `src/routes/api/chat.ts` — streaming endpoint (`streamText` + RAG tool)

### 3. Server functions (`src/lib/chat.functions.ts`)
- `listThreads`, `createThread`, `renameThread`, `deleteThread`
- `getThreadMessages(threadId)`
- `searchKb({query, categoryFilter, k})` — reuse logic จาก `kb.functions.ts` (embed query → cosine similarity → top-k chunks)

### 4. Chat backend (`src/routes/api/chat.ts`)
- รับ `messages[]`, `threadId`, `categoryFilter`
- **RAG flow ก่อนเรียก LLM**: embed ข้อความล่าสุดของผู้ใช้ → ดึง top-5 chunks จาก `kb_chunks` → ใส่ใน system prompt เป็น context พร้อมหมายเลข [1][2]...
- เรียก `streamText` ด้วย system ภาษาไทย ("คุณคือผู้ช่วยตอบกฎระเบียบราชการ อ้างอิงเฉพาะจาก context ที่ให้...")
- `onFinish`: บันทึก assistant message + citations array ลง DB

### 5. UI (AI Elements)
ติดตั้ง: `bun x ai-elements@latest add conversation message prompt-input shimmer`
- **Layout**: sidebar thread list (เหมือน ChatGPT) + main conversation
- **Composer**: PromptInput + dropdown กรอง category KB (optional)
- **Message**: render markdown ผ่าน `MessageResponse`; ใต้ข้อความ assistant แสดง `<CitationsList citations={...} />` (reuse component ที่มีอยู่แล้ว `src/components/citations-list.tsx`)
- **Empty state**: แสดงคำถามตัวอย่าง 4 ข้อ ("ระเบียบการลาป่วยกี่วันต้องมีใบรับรองแพทย์?", ฯลฯ)
- ปุ่ม "สนทนาใหม่", rename inline, ลบ (พร้อม confirm)

### 6. Sidebar & i18n
- เพิ่มเมนู **"ถาม-ตอบ KB"** (`/chat`) ใน `app-sidebar.tsx` กลุ่มหลัก (ใต้ Run)
- เพิ่ม keys ใน `messages.ts`: `nav_chat`, `chatTitle`, `chatEmptyHint`, `newChat`, ฯลฯ
- เพิ่มเข้า command palette

## ส่วนที่ reuse ของเดิม
- `kb_documents` + `kb_chunks` + embedding logic จาก `src/lib/kb.functions.ts`
- `src/components/citations-list.tsx`
- Auth middleware + bearer attacher (มีอยู่แล้ว)
- PII redaction ก่อนส่ง embed/LLM (จาก `src/lib/pii.ts`)

## ไม่ทำในรอบนี้
- Voice input, file attachment ใน chat, แชร์ thread กับเพื่อนร่วมงาน, export thread เป็น PDF (เก็บเป็น phase 2)

## หลังบิลด์เสร็จ smoke test
1. สร้าง thread → ส่งคำถาม → เห็น streaming + citations
2. รีโหลดหน้า → ข้อความยังอยู่
3. สร้าง thread ที่ 2 → สลับไปมา ไม่มีข้อความปนกัน
4. ลบ thread → หายจากลิสต์
5. ถามคำถามนอก KB → AI ตอบว่า "ไม่พบในเอกสารอ้างอิง"

---

อนุมัติแผนนี้เพื่อเริ่ม implement ได้เลยครับ
