## เป้าหมาย
เปลี่ยน "Agent & Skills" → "Skills" อย่างเดียว: ตัด Agent ออกหมด ให้ผู้ดูแลหน่วยงาน (dept_admin) สร้าง Skill กลางที่แชร์ให้คนในหน่วยงานเรียกใช้ได้ทันทีจากหน้า Skills เอง และจากช่อง Skill selector ใน Chat / สั่งงาน AI / วิจัยเชิงลึก ส่วน Skill ส่วนตัวเดิม (user_skills) คงอยู่ในหน้า Settings ตามเดิม

## โครงสร้างใหม่ของเมนู

```text
Sidebar
├── (เดิม) Agent & Skills        ❌ ลบ
└── Skills                        ✅ ใหม่ — เปิดให้ทุก role
    └── (ปุ่ม "จัดการ Skills" ปรากฏเฉพาะ dept_admin / admin)
```

หน้า `/skills` มี 2 โหมดในไฟล์เดียว:
- **ผู้ใช้ทั่วไป**: เห็นเฉพาะ catalog ของ shared skills ของหน่วยงานตนเอง + ใช้งานทันที
- **Dept admin**: เห็นปุ่ม "+ สร้าง Skill", แก้/ปิดใช้/จัดเรียง skill ของหน่วยงาน

## หน้าจอ

### 1. `/skills` (Skill Library)
- Grid ของการ์ด skill: ไอคอน, ชื่อ, คำอธิบายสั้น, badge หมวด, badge "หน่วยงาน: X"
- ค้นหา + filter หมวด
- คลิกการ์ด → เปิด **Skill Runner panel** ด้านขวา:
  - แสดง prompt template / ตัวอย่างผลลัพธ์
  - ช่อง input (textarea + แนบไฟล์ + เสียง) เหมือนหน้า /run
  - ปุ่ม "เรียกใช้" → ยิงผ่าน `runAgent` (ส่ง skill_id แทน agent_id) → บันทึก `ai_runs` ปกติ
  - ปุ่ม "เปิดในแชต" / "เปิดในวิจัยเชิงลึก" (deep-link พร้อม preselect skill)

### 2. `/skills/manage` (เฉพาะ dept_admin)
- ตารางรายการ shared skills ของหน่วยงาน: ชื่อ, หมวด, สถานะ, อัพเดตล่าสุด, ผู้สร้าง
- Drawer ฟอร์มสร้าง/แก้ Skill: name, icon, category, description, role_prompt (system), example_output, default_model_selector, is_active, sort_order
- ปุ่ม "Duplicate from default" — โคลนจาก DEFAULT_SKILLS 8 ชุด
- ปุ่ม Publish/Unpublish

### 3. การฝัง Skill selector ในหน้าอื่น
- **Chat (`/chat/$threadId`)**: dropdown "Skill" เหนือ composer — รวม shared+personal, default = none
- **สั่งงาน AI (`/run`)**: เปลี่ยน skill selector เดิม → รวม shared skills ของหน่วยงาน
- **วิจัยเชิงลึก (`/research`)**: skill selector ที่มีอยู่แล้ว — เพิ่ม shared skills เข้าไป
- ทุกหน้าใช้ helper เดียวกัน `loadSkillPrompt(supabase, userId, skillId)` ที่ขยายให้รองรับทั้ง user_skills และ shared_skills

## เปลี่ยนแปลงฐานข้อมูล

ตารางใหม่ `public.shared_skills`:
- `id uuid pk`
- `department text not null`
- `name text`, `icon text`, `category text`, `description text`, `example_output text`
- `role_prompt text not null`
- `default_model_selector text`
- `sort_order int default 0`, `is_active bool default true`
- `created_by uuid`, `created_at`, `updated_at` (trigger `set_updated_at`)

RLS:
- SELECT: ผู้ใช้ที่ `is_in_department(auth.uid(), department)` หรือ `has_role(admin)`
- INSERT/UPDATE/DELETE: `is_dept_admin(auth.uid(), department)`
- GRANT SELECT, INSERT, UPDATE, DELETE TO authenticated; GRANT ALL TO service_role

ตารางเดิมที่จะ **drop**: `dept_agents`, `dept_skills`, `dept_agent_skills` (พร้อม backup ใน migration ก่อน drop) — เพราะตัดแนวคิด Agent ทิ้ง
> ถ้ามีข้อมูลเดิมใน `dept_skills` จะ migrate ไป `shared_skills` ก่อน drop

`dept_model_providers` / `dept_model_routes` **คงไว้** (ระบบ routing AI ใช้อยู่)

## ไฟล์ที่จะแก้

ลบ:
- `src/routes/_authenticated/agents.tsx`
- `src/routes/_authenticated/agents.index.tsx`
- `src/routes/_authenticated/agents.manage.tsx`
- `src/routes/_authenticated/agents.manage.runs.tsx`  *(ย้าย runs ไป /history ถ้ายังต้องการ — โดยทั่วไป /history มีอยู่แล้ว)*
- `src/lib/dept-agents.functions.ts`
- (คง `agents.manage.providers.tsx` แต่ย้ายเป็น `/admin/providers` หรือใต้ `/admin/settings` เพราะเป็นการตั้งค่า provider ไม่ใช่ agent)

สร้างใหม่:
- `src/routes/_authenticated/skills/index.tsx` — Skill library + runner
- `src/routes/_authenticated/skills/manage.tsx` — เฉพาะ dept_admin
- `src/lib/shared-skills.functions.ts` — list/upsert/delete/run + helper `loadAnySkillPrompt`
- `supabase/migrations/<ts>_shared_skills.sql`

แก้:
- `src/components/app-sidebar.tsx` — เปลี่ยน item `/agents` เป็น `/skills` (icon: Sparkles), ย้าย Providers ไป admin group
- `src/routes/_authenticated/run/index.tsx`, `/research/index.tsx`, `/chat/*` — Skill selector รวม shared+personal
- `src/lib/user-skills.functions.ts` — แยก `loadSkillPrompt` ให้รับได้ทั้ง 2 source
- `src/lib/ai.functions.ts` — `runAgent` รับ `skillId` (shared หรือ personal) แทน `agentId` legacy; เก็บ `AGENTS` built-in สำหรับ backward compat แต่ไม่โชว์ใน UI

## รายละเอียดเทคนิคย่อ
- ใช้ `createServerFn` + `requireSupabaseAuth` ทุกตัว (เช็คสิทธิ์ dept_admin ก่อน mutation ด้วย `is_dept_admin`)
- หน้า `/skills/manage` คุ้มกันด้วย `beforeLoad` ตรวจ `has_role('dept_admin'|'admin')` — ถ้าไม่ผ่าน redirect `/skills`
- Skill Runner ใน `/skills` reuse logic จาก `/run` (extract เป็น `<SkillRunPanel />` ใน `src/components/skill-run-panel.tsx`)
- ทุก run บันทึก `ai_runs.metadata.skill = { id, source: 'shared'|'personal', name }` เพื่อตรวจย้อนหลัง
- i18n: เพิ่ม key `nav_skills`, `skills_library_title`, `skills_manage_title` ใน `messages.ts`

## ลำดับงาน
1. Migration: สร้าง `shared_skills` + RLS + GRANT, migrate dept_skills → shared_skills, drop ตาราง dept_agents/dept_skills/dept_agent_skills
2. Server fns + helper รวม skill source
3. หน้า `/skills` + `/skills/manage` + component `SkillRunPanel`
4. เปลี่ยน sidebar + ลบไฟล์ `agents.*`
5. เชื่อม Skill selector ใน Chat / Run / Research
6. ทดสอบ: ผู้ใช้ทั่วไปเห็น/รัน, dept_admin สร้าง/แก้, รันแล้วบันทึก `ai_runs` ถูกต้อง
