# Phase 5 — Refine ผลลัพธ์ (ทางการขึ้น / สั้นลง / ฯลฯ)

ให้ผู้ใช้ปรับผลลัพธ์ AI ที่ได้แล้ว โดยไม่ต้องเริ่มใหม่ พร้อมเก็บประวัติเวอร์ชันเพื่อย้อนกลับได้

## สิ่งที่จะสร้าง

### 1. Server function: `refineRun` (`src/lib/ai.functions.ts`)
- รับ `runId` + `instruction` (preset หรือ custom)
- โหลด run เดิม, สั่ง AI แก้ไขผลลัพธ์ตาม instruction (system: รักษาความหมายเดิม, คงโครงสร้างราชการ)
- ผ่าน PII redaction + prompt-guard เหมือน `runTemplate`
- บันทึก revision ใน `ai_runs.metadata.revisions` (array: `{output, instruction, at, usage}`) — เก็บได้สูงสุด 10 เวอร์ชัน
- อัปเดต `output` เป็นเวอร์ชันใหม่, รวม usage เข้ากับ run เดิม (เพิ่ม tokens/cost)
- เขียน audit log `ai.refine`

### 2. Migration: เพิ่มคอลัมน์ `metadata` ใน `ai_runs`
```sql
ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
```

### 3. UI Refine bar ใน `src/routes/_authenticated/run/$templateId.tsx`
แสดงใต้กล่องผลลัพธ์ (เมื่อมี `runId`):

- ปุ่ม preset 5 ตัว: **ทางการขึ้น**, **สั้นลง**, **ละเอียดขึ้น**, **เป็นมิตรขึ้น**, **แก้คำผิด**
- ช่องพิมพ์คำสั่งเอง + ปุ่ม "ปรับ"
- ระหว่างโหลด: spinner + disable
- หลังสำเร็จ: แทนที่ output, toast แจ้ง, เพิ่มจำนวน revision

### 4. Version history & undo
- ถ้ามี ≥1 revision แสดงปุ่ม "เวอร์ชัน (N)" → popover รายการเวอร์ชัน (เวลา + instruction)
- เลือกเวอร์ชันใดจะ preview, มีปุ่ม "กู้คืน" → call `revertRun({runId, index})` ที่ swap output กลับ
- ปุ่ม "Undo" ลัด = กู้คืนเวอร์ชันก่อนหน้า

### 5. หน้า history detail (`src/routes/_authenticated/history/$runId.tsx`)
- แสดง badge "ปรับ N ครั้ง" ถ้ามี revisions
- มี Refine bar + version list เดียวกัน

## รายละเอียดเทคนิค

System prompt สำหรับ refine:
```
คุณเป็นบรรณาธิการเอกสารราชการไทย จงปรับข้อความที่ได้รับตามคำสั่งของผู้ใช้
ห้ามเพิ่มข้อมูลใหม่ที่ไม่มีในต้นฉบับ ห้ามตัดข้อมูลสำคัญ (ชื่อ วันที่ เลขที่)
รักษารูปแบบหนังสือราชการ คืนเฉพาะข้อความที่ปรับแล้ว
```

User prompt: `คำสั่ง: {instruction}\n\nข้อความต้นฉบับ:\n{currentOutput}`

Preset instructions:
- formal: "ปรับโทนให้เป็นทางการขึ้น ใช้คำศัพท์ราชการ"
- shorter: "ย่อให้สั้นลง คงสาระสำคัญ"
- longer: "ขยายความให้ละเอียดและครบถ้วนขึ้น"
- friendly: "ปรับโทนให้เป็นมิตรและอ่านง่ายขึ้น แต่ยังคงความสุภาพ"
- proofread: "ตรวจแก้คำผิด ไวยากรณ์ และการเว้นวรรค คงโครงสร้างเดิม"

## ไฟล์ที่จะแก้/สร้าง
- new: `supabase/migrations/<timestamp>_add_runs_metadata.sql`
- edit: `src/lib/ai.functions.ts` — เพิ่ม `refineRun`, `revertRun`
- edit: `src/routes/_authenticated/run/$templateId.tsx` — Refine bar + version history
- edit: `src/routes/_authenticated/history/$runId.tsx` — Refine bar + badge

## ไม่ทำในรอบนี้
- Streaming output (A1) — แยกรอบ
- Diff view ระหว่างเวอร์ชัน (อาจเพิ่มภายหลัง)
- Editor แบบ tiptap — ใช้ textarea เดิมที่มี Edit mode อยู่แล้ว
