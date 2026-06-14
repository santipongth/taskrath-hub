# Master Prompt Pack — TaskRath (ทาสก์-รัฐ)

ชุดเอกสารสำหรับใช้เป็น context ตั้งต้นใน **Claude Code** เพื่อพัฒนา/ขยายระบบ TaskRath ต่อ

> TaskRath = ผู้ช่วย AI สำหรับงานราชการไทย สร้างบน TanStack Start + Lovable Cloud (Supabase) + Lovable AI Gateway รัน on Cloudflare Workers

## วิธีใช้กับ Claude Code

### 1. โหลด context ตั้งต้นทุก session
```
@docs/master-prompts/00-index.md
@docs/master-prompts/01-product-overview.md
@docs/master-prompts/02-tech-stack.md
@docs/master-prompts/03-architecture.md
@docs/master-prompts/15-coding-conventions.md
```

### 2. โหลดเฉพาะทางตามงานที่ทำ
| งาน | ไฟล์เพิ่มเติม |
|---|---|
| ปรับ UI / theme | `04-design-system.md`, `05-ui-components.md` |
| เพิ่ม route / page | `06-routing-map.md` |
| เพิ่ม/แก้ table, RLS | `07-database-schema.md`, `14-security-compliance.md` |
| งาน AI / streaming / prompt | `08-core-engine-ai.md` |
| RAG / KB / Chat | `09-rag-kb-chat.md` |
| เพิ่มเทมเพลตเอกสาร | `10-templates-engine.md` |
| Export PDF/DOCX / signature | `11-export-signatures.md` |
| หน้า admin / governance | `12-admin-governance.md` |
| i18n / wording | `13-i18n-localization.md` |

### 3. ใช้ prompt สำเร็จรูปจาก `16-task-prompts.md`
ก๊อปแล้ววางใน Claude Code — แต่ละ prompt จะอ้างถึงไฟล์อื่นที่ต้องโหลดด้วย

### 4. roadmap & สิ่งที่ยังไม่ทำ
ดู `17-roadmap-backlog.md` ก่อนเสนอฟีเจอร์ใหม่ — หลายเรื่องมีการตัดสินใจไว้แล้ว

## สารบัญ

| # | ไฟล์ | สรุป |
|---|---|---|
| 00 | index.md | (ไฟล์นี้) |
| 01 | product-overview.md | วิสัยทัศน์ ผู้ใช้ ฟีเจอร์ |
| 02 | tech-stack.md | Stack ทั้งหมด + version |
| 03 | architecture.md | Flow data, layer, import graph |
| 04 | design-system.md | สี ฟอนต์ token spacing motion |
| 05 | ui-components.md | shadcn + AI Elements + custom |
| 06 | routing-map.md | ทุก route และหน้าที่ |
| 07 | database-schema.md | 13 ตาราง + RLS + has_role |
| 08 | core-engine-ai.md | ai.functions.ts, gateway, cost |
| 09 | rag-kb-chat.md | embedding, chunking, citations |
| 10 | templates-engine.md | templates.ts + custom_templates |
| 11 | export-signatures.md | PDF/DOCX + ตราครุฑ + QR verify |
| 12 | admin-governance.md | admin pages, audit, approvals |
| 13 | i18n-localization.md | messages.ts (th/en) |
| 14 | security-compliance.md | RLS, PII, prompt-guard, พ.ร.บ. |
| 15 | coding-conventions.md | naming, serverFn, Zod, import |
| 16 | task-prompts.md | prompt สำเร็จรูปสำหรับ Claude Code |
| 17 | roadmap-backlog.md | สิ่งที่ยังไม่ทำ + เหตุผล |
