# 09 — RAG / KB / Chat

## ภาพรวม
- **KB**: admin อัปโหลดเอกสาร (PDF/DOCX/TXT) → chunk → embed → เก็บใน `kb_chunks`
- **Search**: ผู้ใช้ถาม → embed query → cosine similarity → top-k chunks → ใส่ใน system prompt
- **Chat**: หลายเทิร์น พร้อม citations แสดง chunk ที่ใช้ตอบ

## ไฟล์
| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/kb.functions.ts` | upload, chunk, embed, search |
| `src/lib/chat.functions.ts` | thread + message CRUD |
| `src/routes/_authenticated/admin/knowledge.tsx` | admin UI |
| `src/routes/_authenticated/chat/$threadId.tsx` | chat UI |
| `src/components/citations-list.tsx` | render citations |

## Embedding
```ts
const EMBED_MODEL = "openai/text-embedding-3-small";
const EMBED_DIM = 1536;

// POST https://ai.gateway.lovable.dev/v1/embeddings
// body: { model, input: string[], dimensions: 1536 }
```

## Chunking
- แบ่งเอกสาร ~500–800 tokens/chunk (overlap ~100)
- เก็บ `kb_chunks { doc_id, chunk_index, content, embedding vector(1536), metadata jsonb }`
- ใช้ pgvector extension (ต้อง enable ใน migration)

## Search (`retrieveKbContext`)
1. `embedBatch([query])` → `[[...1536 floats]]`
2. SQL: `select ... order by embedding <=> $1 limit k` (cosine distance)
3. filter `kb_documents.category = $category` ถ้ามี
4. return:
```ts
{
  block: "[1] doc title — snippet ...\n[2] ...",
  citations: Citation[]  // { doc_id, chunk_id, title, score, snippet }
}
```

## Citation Type
```ts
export type Citation = {
  doc_id: string;
  chunk_id: string;
  title: string;
  score: number;     // 0..1 (1 = ตรงที่สุด)
  snippet: string;   // first ~200 chars
};
```

## Chat (`chat.functions.ts`)
serverFn ที่มี:
- `listChatThreads()` — order by updated_at desc
- `createChatThread({ title?, categoryFilter? })`
- `renameChatThread({ id, title })`
- `deleteChatThread({ id })`
- `getThreadMessages({ threadId })`
- `appendChatMessage({ threadId, role, content, citations })` — บันทึก message

Streaming endpoint สำหรับ chat → ใช้ `runChat` serverFn (raw response) ที่:
1. รับ `{ threadId, content, categoryFilter }`
2. `redactPII(content)` + `checkPromptInjection`
3. โหลดประวัติเดิมจาก `chat_messages` (last N)
4. `retrieveKbContext({ query: content, k: 5, category })`
5. compose messages: `[{ role: system, content: ... + KB block }, ...history, { role: user, content }]`
6. fetch gateway stream
7. onFinish: insert assistant message + citations array

## System Prompt ภาษาไทย (chat)
```
คุณคือผู้ช่วยตอบกฎระเบียบราชการของหน่วยงาน
- อ้างอิงเฉพาะจาก <ระเบียบที่เกี่ยวข้อง> เท่านั้น ห้ามแต่งเอง
- ใช้รูปแบบอ้างอิง [หมายเลข] ท้ายประโยคที่เกี่ยวข้อง
- หากไม่พบข้อมูลในเอกสารอ้างอิง ให้ระบุชัดเจนว่า "ไม่พบในเอกสารอ้างอิง"
- ใช้ภาษาทางการ สุภาพ ตรงประเด็น
```

## UI (chat page)
- Sidebar: รายการ thread + ปุ่มสนทนาใหม่ + rename inline + ลบ (confirm)
- Main: AI Elements `Conversation` + `Message` + `PromptInput`
- ใต้ assistant message: `<CitationsList citations={...} />`
- Empty state: 4 คำถามตัวอย่าง

## ข้อห้าม
- ห้ามใส่ `categoryFilter` แล้วลืม validate (max 100, alphanumeric)
- ห้ามดึง chunk เกิน `k=10` (cost + context overflow)
- ห้าม log message content ใน `audit_logs` (เก็บ thread_id + token counts พอ)
- chat แต่ละ thread เห็นเฉพาะของตัวเอง (RLS: `user_id = auth.uid()`)
