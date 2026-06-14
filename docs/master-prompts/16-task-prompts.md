# 16 — Master Task Prompts (พร้อมก๊อปใช้ใน Claude Code)

> ใช้คู่กับการโหลด context จาก `00-index.md` — แต่ละ prompt บอกไฟล์เสริมที่ต้องโหลด

---

## A) เพิ่มเทมเพลตใหม่ (built-in)

```
[Context]
@docs/master-prompts/10-templates-engine.md
@docs/master-prompts/15-coding-conventions.md
@src/lib/templates.ts
@src/lib/ai.functions.ts

[Task]
เพิ่มเทมเพลตชื่อ "<TITLE_TH>" / "<TITLE_EN>" หมวด <CATEGORY>
- slug: <slug-kebab-case>
- icon: <LucideIconName>
- description (TH/EN): <...>
- system prompt ภาษาไทย (เน้นโทนราชการ): <...>
- fields:
    1. {name, label TH/EN, type, required}
    2. ...

ขั้นตอน:
1. เพิ่มใน TEMPLATES array ของ src/lib/templates.ts
2. เพิ่ม mapping ใน TEMPLATE_PROMPTS ของ src/lib/ai.functions.ts
3. ไม่ต้องสร้าง route (/run/$templateId รับทุก slug)
4. ทดสอบโดยเปิด /templates → คลิก card → /run/<slug> → กรอกฟอร์ม → Run
```

---

## B) เพิ่ม serverFn พร้อม migration

```
[Context]
@docs/master-prompts/07-database-schema.md
@docs/master-prompts/15-coding-conventions.md
@docs/master-prompts/14-security-compliance.md
@docs/master-prompts/08-core-engine-ai.md  (ถ้าเกี่ยวกับ AI)

[Task]
สร้างฟีเจอร์ <FEATURE_NAME>:
- ตาราง public.<table_name> เก็บ: <fields>
- ผู้ใช้เห็นเฉพาะของตัวเอง (admin เห็นทั้งหมด)
- serverFn ที่ต้องการ:
    - list<X>()
    - create<X>(input)
    - update<X>({ id, ...patch })
    - delete<X>({ id })

ขั้นตอน:
1. สร้าง migration: CREATE TABLE + GRANT + ENABLE RLS + POLICY + updated_at trigger
   (ตามแม่แบบใน 07-database-schema.md)
2. สร้าง src/lib/<feature>.functions.ts ด้วย pattern:
   .middleware([requireSupabaseAuth]).inputValidator(zod).handler(...)
3. ทุก write input: Zod validate ขั้นต่ำ/สูงสุด
4. ห้าม import client.server ที่ top-level — ใช้ await import() ใน handler ถ้าจำเป็น
```

---

## C) เพิ่มหน้า admin

```
[Context]
@docs/master-prompts/06-routing-map.md
@docs/master-prompts/12-admin-governance.md
@docs/master-prompts/05-ui-components.md
@src/routes/_authenticated/admin/templates.tsx  (ตัวอย่าง)

[Task]
สร้างหน้า /admin/<name> ที่:
- ใช้ได้เฉพาะ has_role('admin')
- แสดง <DESCRIBE_UI>
- เรียก serverFn: <...>

ขั้นตอน:
1. สร้าง src/routes/_authenticated/admin/<name>.tsx
   - createFileRoute("/_authenticated/admin/<name>")
   - beforeLoad: check admin → ถ้าไม่ใช่ redirect "/"
2. เพิ่มเมนูใน src/components/app-sidebar.tsx (กลุ่ม Admin)
3. เพิ่ม key ใน src/lib/messages.ts
4. รันแล้วเปิด /admin/<name> ตรวจ
```

---

## D) Debug build / runtime error

```
[Context]
@docs/master-prompts/03-architecture.md
@docs/master-prompts/15-coding-conventions.md

[Task]
มี error: <PASTE ERROR>
ในไฟล์: <PATH:LINE>

ตรวจตามลำดับ:
1. ถ้า "Failed to resolve import": ไฟล์/แพ็กเกจมีจริงหรือไม่ (bun add ก่อน import)
2. ถ้า route-tree mismatch: ตรวจ filename ↔ createFileRoute("...") ให้ตรง
3. ถ้า Unauthorized ตอน build: เช็คว่าใส่ protected serverFn ใน loader ของ public route
4. ถ้า "is not implemented yet": ใช้ Node-only API ที่ Worker ไม่รองรับ (เปลี่ยน lib)
5. ถ้า RLS permission error: ตรวจ GRANT + policy ของตารางนั้น

อย่ารัน `npm run build` เอง — harness รันให้
```

---

## E) เพิ่ม wording / i18n key

```
[Context]
@docs/master-prompts/13-i18n-localization.md
@src/lib/messages.ts

[Task]
เพิ่ม key:
- <key1>: TH="..." EN="..."
- <key2>: ...

อย่า hard-code string ใน component — ใช้ useI18n().t(key)
ตรวจให้คงโทนทางการแบบราชการ (TH) / sentence case (EN)
```

---

## F) เพิ่ม custom template ผ่าน admin UI (ไม่ใช่โค้ด)

```
[Context]
@docs/master-prompts/10-templates-engine.md (Section B)

[Task]
แนะนำผู้ใช้ใช้ /admin/templates สร้างเทมเพลตใหม่ — ไม่ต้องแก้โค้ด
```

---

## G) เพิ่มฟีเจอร์ chat / RAG

```
[Context]
@docs/master-prompts/09-rag-kb-chat.md
@docs/master-prompts/08-core-engine-ai.md
@src/lib/chat.functions.ts
@src/lib/kb.functions.ts

[Task]
<DESCRIBE>

ตรวจ:
- streaming ผ่าน response: "raw" + ReadableStream
- redactPII + checkPromptInjection ทุกครั้ง
- ใส่ citations ลง chat_messages.citations (jsonb)
- ไม่ log content ลง audit_logs
```

---

## H) เพิ่ม export option / signature feature

```
[Context]
@docs/master-prompts/11-export-signatures.md
@src/lib/export.ts
@src/components/export-dialog.tsx

[Task]
<DESCRIBE>

ตรวจ:
- ทั้ง PDF (jspdf + Noto Sans Thai) และ DOCX (docx lib) ต้องได้ผลเทียบเท่ากัน
- ถ้าเป็นเอกสารราชการ: ต้องมี header table (ที่/วันที่/เรื่อง/เรียน)
- ถ้ามี signature: SHA-256 ของ (title+content) ต้องสร้าง _ก่อน_ insert signed_documents
```

---

## I) Refactor — บอกบริบทก่อนเสมอ

```
[Context]
โหลด 00-15 ทั้งหมด

[Task]
Refactor <X> โดย:
- ไม่เปลี่ยน behavior ที่ user เห็น
- ไม่แตะ migration เก่า
- ไม่ลบ key ใน messages.ts ที่ยังมีใครใช้
- ทดสอบ build + manual smoke test ตามที่ระบุ
```
