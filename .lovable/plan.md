## บริบท — สรุปสิ่งที่แพลตฟอร์มชั้นนำทำ


| สิ่งที่ผู้สร้างกรอก                        | Claude Skills         | ChatGPT GPT         | Gemini Gem             | ของเรา (ตอนนี้)              |
| ------------------------------------------ | --------------------- | ------------------- | ---------------------- | ---------------------------- |
| Name + Instructions/Prompt                 | ✅                     | ✅                   | ✅                      | ✅                            |
| Description (สั้น)                         | ✅ ใช้ขับ auto-trigger | ✅                   | รวมใน instructions     | ✅                            |
| Icon / Avatar                              | ❌                     | ✅                   | ❌                      | มีฟิลด์แต่ไม่แสดง            |
| Conversation starters (4 prompts ตัวอย่าง) | ❌                     | ✅                   | ❌                      | ❌                            |
| Knowledge files                            | ✅                     | ✅                   | ✅                      | ❌                            |
| Recommended model                          | ❌                     | ✅                   | ❌                      | มีฟิลด์ **แต่ dead code**    |
| Tools / Actions                            | scripts               | actions             | ❌                      | ❌                            |
| Live preview / test pane                   | ❌                     | ✅                   | ✅                      | ❌                            |
| Sharing scopes                             | workspace             | private/link/store  | private/link/workspace | ผู้ใช้ลงชื่อทั้งหมด (active) |
| End-user invocation                        | auto + slash          | search/URL/@mention | sidebar                | dropdown ใน /run /research   |


**Best practices ที่ทุกแพลตฟอร์มเห็นพ้อง**

1. *Required คือ Name + Instructions* — ที่เหลือ optional แต่ Description กับ Conversation Starters มี ROI สูงสุดต่อ UX
2. *Description ต้องเขียนแบบ "Use when… / Best for…"* เพื่อช่วยทั้งคนและ AI เลือกใช้
3. *Conversation starters ลดปัญหา blank page* — สำคัญสำหรับผู้ใช้ใหม่
4. *Recommended model* ควรเป็น dropdown จริงที่ส่งต่อไปยัง inference (ไม่ใช่ free text)
5. *Live preview* ในหน้าแก้ไข — ผู้สร้างควรทดสอบก่อน publish
6. กฎทอง: behavioral rules อยู่ใน Instructions, ข้อมูลอ้างอิงอยู่ใน Knowledge

## Gap ปัจจุบันของโปรเจกต์ (สรุปจาก code map)

- `icon` ถูกเก็บแต่ไม่ render บนการ์ด — ใช้ `<Sparkles>` ทุกใบ
- `default_model_selector` เป็น **dead code** ทั้ง shared และ personal — เก็บแต่ไม่มีจุดอ่านในการ inference
- `example_output` แสดงในชีตด้านขวาของ `/skills` แต่ไม่ได้ใช้เป็น "starter" จริง
- ไม่มี conversation starters / sample prompts
- ไม่มี preview/test pane ในหน้า Details
- `/chat` ไม่รองรับ skill เลย ขณะ `/run`, `/research` รองรับ
- `/research` prefill จาก sessionStorage อ่านเฉพาะ question ไม่เซต `sharedSkillId` (พฤติกรรมต่างจาก `/run`) — น่าจะเป็น bug
- คอลัมน์ `department` บน `shared_skills` ไม่ถูกใช้งานแล้ว — quote dead

## แผน 3 เฟส

```text
Phase 1  (Quick wins — เติมฟิลด์ที่มาตรฐาน) ─── เสนอทำก่อน
   ├─ Icon picker (Lucide) + แสดงจริงในการ์ด /skills, /run, /research
   ├─ Conversation starters: 4 ช่อง (ทดแทน example_output ที่ไม่ได้ใช้จริง)
   ├─ Recommended model: dropdown เลือกจาก dept providers + ส่งต่อไปยัง runFreeform
   ├─ Description ใส่ helper text สไตล์ "Use when…"
   └─ Fix /research prefill ให้เซต sharedSkillId เหมือน /run

Phase 2  (Authoring quality)
   ├─ Test/Preview pane ในหน้า /skills/manage/$skillId
   │    (ฝั่งขวา: textarea + ปุ่ม Run → เรียก runFreeform แบบ ephemeral ไม่บันทึก ai_runs)
   ├─ Version snapshot (เก็บประวัติ role_prompt ใน skill_versions ใหม่)
   └─ Cleanup: ลบ default_model_selector เก่า/แทนด้วย recommended_model
       และลบหรือคงไว้ department column (ผู้ใช้ตัดสินใจ)

Phase 3  (Reach — ใช้ใน Chat & smart discovery)
   ├─ /chat รองรับ skill selector (เหมือน /run)
   ├─ Conversation starters render เป็น "ปุ่มลัด" ที่หน้า /skills detail + เปิด /run หรือ /chat ทันที
   └─ (ทางเลือก) Slash command "/skill-name" ใน chat composer
```

## รายละเอียด Phase 1 (สิ่งที่จะลงมือทันทีหลัง approve)

### 1. Icon picker + แสดงผลจริง

- เพิ่ม component `IconPicker` (เลือกจาก Lucide subset ~30 ตัว ที่เกี่ยวกับงานราชการ: FileText, Mail, Search, FileSpreadsheet, Languages, Megaphone, Calendar, Stamp, ฯลฯ + ตัวเลือก emoji free text)
- เก็บเป็น string `"lucide:FileText"` หรือ `"emoji:✉️"` ใน column `icon` เดิม (ไม่ต้อง migrate)
- helper `<SkillIcon value={s.icon} />` ใช้ใน manage list, /skills card, selector ใน /run, /research

### 2. Conversation starters

- เพิ่มคอลัมน์ `conversation_starters text[]` (สูงสุด 4 ข้อ, ข้อละ 200 ตัวอักษร) บน `shared_skills`
- ฟอร์ม: 4 input rows + ปุ่มเพิ่ม/ลบ
- ใน `/skills` detail sheet: render เป็นชิป กดแล้วไป `/run` พร้อม prefill prompt + skill
- ใน `/run` ตอนเลือก skill: แสดงชิปด้านบน textarea เพื่อ one-click prefill
- เก็บ `example_output` ต่อ (ใช้แสดง preview) แต่ไม่บังคับ — เปลี่ยน label เป็น "Sample output (for users to preview)"

### 3. Recommended model ที่ทำงานจริง

- เปลี่ยน `default_model_selector` เป็น `recommended_provider_id uuid` FK → `dept_model_providers.id` (nullable)
- ฟอร์ม: dropdown แสดง provider ที่ admin ตั้งค่าไว้ (อ่านจาก `listDeptProviders`)
- ใน `/run` และ `/research`: เมื่อผู้ใช้เลือก skill ที่มี recommended provider → preselect provider dropdown (ผู้ใช้ override ได้)
- (ไม่ต้องแตะ runtime logic ของ runFreeform — แค่เปลี่ยนค่า default ฝั่ง client)

### 4. Description helper text

- เพิ่ม placeholder + tooltip ในฟอร์ม: `"เขียนแบบ 'ใช้สำหรับ…' หรือ 'เหมาะกับ…' เพื่อให้ผู้ใช้คนอื่นเลือกใช้ได้ถูก"`

### 5. แก้ research prefill bug

- ใน `/research/index.tsx` mount: อ่าน `sharedSkillId` จาก `sessionStorage("research:prefill")` แล้ว set state เหมือนที่ `/run` ทำ

## รายละเอียดทางเทคนิค (สำหรับนักพัฒนา)

**Migration (Phase 1)**

```sql
ALTER TABLE public.shared_skills
  ADD COLUMN conversation_starters text[] NOT NULL DEFAULT '{}',
  ADD COLUMN recommended_provider_id uuid REFERENCES public.dept_model_providers(id) ON DELETE SET NULL;
-- default_model_selector คงไว้ก่อน (ลบใน Phase 2 หลังย้ายค่าเก่า)
```

**Files ที่จะแก้ใน Phase 1**

- `src/lib/shared-skills.functions.ts` — เพิ่มฟิลด์ใน SELECT_COLS, validator, payload
- `src/components/SkillIcon.tsx` *(ใหม่)*, `src/components/IconPicker.tsx` *(ใหม่)*
- `src/routes/_authenticated/skills/manage/$skillId.tsx` — เพิ่ม icon picker, starters editor, provider dropdown
- `src/routes/_authenticated/skills/manage/index.tsx` — แสดง icon ในการ์ด
- `src/routes/_authenticated/skills/index.tsx` — render icon, starters เป็นชิป
- `src/routes/_authenticated/run/index.tsx` — render starters, preselect provider
- `src/routes/_authenticated/research/index.tsx` — fix prefill + preselect provider
- `src/integrations/supabase/types.ts` — auto-regen หลัง migration

## คำถามที่อยากให้ confirm ก่อนลงมือ

1. **เลือกทำเฉพาะ Phase 1 ก่อน** ใช่ไหม? (Phase 2/3 ค่อยคุยหลังเฟส 1 เสร็จ) ให้ทำ เฟส 1 ก่อน
2. **Icon**: ใช้ Lucide picker (30 ตัว preset) + emoji ฟรีเทกซ์ พอไหม หรืออยากได้ image upload ด้วย? ใช้ Lucide picker (30 ตัว preset) + emoji ฟรีเทกซ์ พอแล้ว
3. **Recommended model**: ผูกกับ `dept_model_providers` (provider ที่ admin ตั้ง) ใช่ไหม — หรืออยากให้เป็น text เลือก model name โดยตรง (เช่น `google/gemini-3-flash-preview`) เป็น text เลือก model name โดยตรง
4. **department column** ที่เป็น dead: ทิ้งไปเลย (drop ใน Phase 1) หรือเก็บไว้เผื่ออนาคต multi-tenant ส่วนนี้ลบทิ้งให้สะอาด ไม่ต้องเหลือเก็บในอนาคต