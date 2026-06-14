# Master Prompt Pack สำหรับ TaskRath (ผู้ช่วย AI งานราชการ)

จะสร้างชุดเอกสาร `.md` ไว้ที่โฟลเดอร์ `docs/master-prompts/` เพื่อใช้เป็น context/บรีฟต่อให้ Claude Code พัฒนาโปรเจกต์ต่อ ครอบคลุมทั้ง **Design System** และ **Core Engine** ของระบบที่มีอยู่จริงในโค้ดเบสนี้

## โครงสร้างไฟล์ที่จะสร้าง

```text
docs/master-prompts/
├── 00-index.md                  # สารบัญ + วิธีใช้กับ Claude Code
├── 01-product-overview.md       # วิสัยทัศน์ ผู้ใช้ ฟีเจอร์หลัก domain ราชการไทย
├── 02-tech-stack.md             # TanStack Start v1, React 19, Vite 7, Tailwind v4,
│                                # Lovable Cloud (Supabase), AI Gateway, Cloudflare Workers
├── 03-architecture.md           # โครงสร้างโฟลเดอร์ + flow: route → serverFn → Supabase/AI
│                                # + กฎ client.server.ts vs auth-middleware vs browser client
├── 04-design-system.md          # โทนภาพรวม, typography (Inter + Noto Sans Thai),
│                                # palette OKLCH, semantic tokens, spacing, motion,
│                                # ความเป็นทางการแบบราชการ + accessibility
├── 05-ui-components.md          # shadcn + AI Elements, AppShell, Sidebar, ExportDialog,
│                                # CitationsList, RefineBar, TemplateCard, CommandPalette
├── 06-routing-map.md            # ทุก route ที่มี (public, _authenticated, admin/*, api/*)
│                                # พร้อมหน้าที่และ data dependencies
├── 07-database-schema.md        # 13 tables + RLS + GRANT pattern + has_role + user_roles
├── 08-core-engine-ai.md         # ai.functions.ts: streaming, model gateway,
│                                # PII redaction, prompt-guard, refine loop, cost tracking
├── 09-rag-kb-chat.md            # kb.functions.ts + chat.functions.ts: embedding, chunking,
│                                # cosine search, citations, multi-turn threads
├── 10-templates-engine.md       # templates.ts (hard-coded) + custom_templates (DB),
│                                # field schema, system prompt convention,
│                                # 5 government templates (committee/kpr/tor/py12/budget)
├── 11-export-signatures.md      # export.ts (PDF/DOCX) + letterhead (ตราครุฑ) +
│                                # signatures.functions.ts (SHA-256 + QR verify) + /verify/$id
├── 12-admin-governance.md       # admin pages, audit logs, agency settings, approvals,
│                                # executive stats, notifications
├── 13-i18n-localization.md      # messages.ts (th/en), Thai gov tone, ใช้ key อย่างไร
├── 14-security-compliance.md    # RLS, PII, prompt injection guard, พ.ร.บ.ธุรกรรมฯ,
│                                # ระเบียบสารบรรณ, classification/urgency
├── 15-coding-conventions.md     # naming, file layout, serverFn pattern (.middleware →
│                                # .inputValidator → .handler), Zod, import rules
├── 16-task-prompts.md           # Master prompt templates พร้อมใช้ใน Claude Code:
│                                #  - "เพิ่มเทมเพลตใหม่"
│                                #  - "เพิ่ม serverFn + migration"
│                                #  - "เพิ่มหน้า admin"
│                                #  - "debug build error"
│                                #  - "เพิ่มภาษา/ปรับ wording"
└── 17-roadmap-backlog.md        # สิ่งที่ยังไม่ทำ (voice input, attachment, share thread,
                                 # co-sign, PKI, template versioning) สำหรับ context ต่อยอด
```

## เนื้อหาแต่ละไฟล์ (สรุปสาระสำคัญ)

- **อ้างอิงโค้ดจริง**: ทุกไฟล์จะอ้าง path และ symbol ที่มีอยู่ในโปรเจกต์ เช่น `src/lib/ai.functions.ts`, `requireSupabaseAuth`, `attachSupabaseAuth`, ตาราง `ai_runs`/`chat_messages`/`custom_templates`/`signed_documents`
- **มี code snippet ตัวอย่าง**: pattern ของ `createServerFn`, migration พร้อม GRANT + RLS, การเรียก Lovable AI Gateway, การ render letterhead/QR
- **เขียนเป็นภาษาไทยเป็นหลัก** (สอดคล้องกับ domain) มี term อังกฤษกำกับเฉพาะที่จำเป็น
- **ไฟล์ 16 (task prompts)** เขียนเป็น "prompt สำเร็จรูป" ที่ก๊อปไปวาง Claude Code ได้ทันที โดยอ้าง 00-15 เป็น context

## วิธีนำไปใช้ใน Claude Code

ไฟล์ `00-index.md` จะอธิบายว่า:
1. โหลด `00`–`07` เป็น context ตั้งต้นทุก session
2. โหลดไฟล์เฉพาะทาง (08–14) เมื่อทำงานในส่วนนั้น ๆ
3. ใช้ `15` เป็น style guide
4. ก๊อป prompt จาก `16` เมื่อจะสั่งงานใหม่

## สิ่งที่จะไม่ทำในรอบนี้
- ไม่แก้โค้ดแอป ไม่เพิ่ม route/feature — เป็นเอกสารล้วน ๆ
- ไม่สร้าง diagram เป็นรูป (ใช้ ASCII/Mermaid ใน markdown แทน)
- ไม่ copy zip ออกไป — ไฟล์ทั้งหมดอยู่ใน repo ที่ `docs/master-prompts/`

---

อนุมัติแผนนี้เพื่อให้เริ่มสร้างไฟล์ทั้งหมดได้เลยครับ หรือบอกได้ถ้าอยากตัด/เพิ่ม/รวมไฟล์ไหน
