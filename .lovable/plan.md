
# Agent & Skills แบบหน่วยงานสร้างเองได้ (Department-scoped Ecosystem)

## เป้าหมาย
ให้ "Admin หน่วยงาน" (dept_admin) สร้าง/แก้ **Skill** และ **Agent** ของหน่วยงานตัวเองได้  
สมาชิกในหน่วยงานเดียวกันใช้ได้ทุกคน — ไม่แชร์ข้ามหน่วยงาน — ระบบจึงโตเองตามการใช้งานจริง

## โมเดลแนวคิด

```
Department ── owns ──▶ Skills (atomic capability)
                 └──▶ Agents (persona + skills[] + system prompt)
                                │
                                ▼
                         User runs Agent
                         → Agent ใช้ skills เป็น tool/step
                         → log ai_runs (dept_id)
```

- **Skill** = หน่วยความสามารถเดี่ยว  
  - `name`, `description`, `system_prompt`, `fields[]` (เหมือน custom_templates), `kb_category?`, `model?`, `needs_approval?`
- **Agent** = persona ที่รวม skill หลายตัว  
  - `name`, `role_prompt` (บทบาท/บุคลิก), `skill_ids[]`, `default_skill_id?`, `tools_mode` (single | workflow)
  - เวลารัน: agent เลือก skill ที่เหมาะ หรือรันตามลำดับ (workflow)

## สิ่งที่จะสร้าง (เฟส 1 — MVP)

### 1) Database (migration ใหม่)
- เพิ่ม role `dept_admin` ลง enum `app_role`
- ตาราง `dept_skills` (department_id, name, description, system_prompt, fields jsonb, kb_category, model, needs_approval, created_by, status: draft|active)
- ตาราง `dept_agents` (department_id, name, role_prompt, default_model, status, created_by)
- ตาราง `dept_agent_skills` (agent_id, skill_id, order_index) — many-to-many
- ทุกตาราง: GRANT + RLS
  - SELECT: สมาชิก department เดียวกัน (`profiles.department = X`)
  - INSERT/UPDATE/DELETE: เฉพาะ `dept_admin` ของ department นั้น
  - admin (global) เห็นทุก department
- `has_dept_role(uid, dept_id, role)` security-definer helper

### 2) Server Functions (`src/lib/dept-agents.functions.ts`)
- `listDeptSkills() / upsertDeptSkill() / deleteDeptSkill()`
- `listDeptAgents() / upsertDeptAgent() / deleteDeptAgent()`
- `runDeptAgent({ agentId, input, skillId? })`
  - ดึง agent + skills ของ dept
  - ประกอบ system prompt = `agent.role_prompt` + skill ที่เลือก
  - เรียก pipeline เดิม (PII redact → guard → RAG → gateway → log ai_runs พร้อม `dept_id`)
- ทุก fn `.middleware([requireSupabaseAuth])` + ตรวจ dept membership / dept_admin

### 3) UI — เมนู Agents & Skills (เพิ่มในหน้า `/agents` เดิม)
- Tab "Built-in" (เดิม) | "หน่วยงานของฉัน" (ใหม่)
- การ์ด agent ของหน่วยงาน + ปุ่ม "สั่งงาน" (เหมือนเดิม)
- ถ้าเป็น `dept_admin`: เห็นปุ่ม **"+ สร้าง Agent"** / **"จัดการ Skill"**
- หน้าใหม่ `/agents/manage` (gate ด้วย dept_admin)
  - **Skills tab**: list + dialog editor (name, description, system prompt, fields builder, kb category, model)
  - **Agents tab**: list + editor (name, role prompt textarea, multi-select skill, default skill, model)
  - ปุ่ม "ทดสอบรัน" inline ในตัว editor

### 4) Integration กับระบบเดิม
- `ai_runs` เพิ่มคอลัมน์ `dept_agent_id`, `dept_skill_id` (nullable) → ใช้ใน `/admin/usage` แยกตาม dept ได้
- รายงาน PDF/CSV: เพิ่ม section "Top agents per department" (ใช้คอลัมน์ใหม่)

## เฟส 2 (อนาคต — ยังไม่ทำตอนนี้)
- Workflow / multi-step: agent เรียก skill ต่อเป็น pipeline
- Versioning ของ skill (draft → publish)
- Marketplace ข้ามหน่วยงาน (ตอนนี้ไม่เอา)

## รายละเอียดทางเทคนิคที่ควรทราบ

- ใช้ `profiles.department` ที่มีอยู่แล้วเป็น `department_id` (string slug)
- RLS pattern: ทุก policy ใช้ helper `is_in_department(uid, dept)` + `has_role(uid, 'dept_admin')` AND ตรง dept
- Sidebar เพิ่มลิงก์ "จัดการ Agent (หน่วยงาน)" เฉพาะ dept_admin
- เก็บ `fields` jsonb เป็น schema เดียวกับ `custom_templates` เพื่อ reuse `<RunForm/>` ได้เลย
- Token/cost ยังคำนวณรวมที่ระดับ workspace (ไม่แยก quota ต่อ dept ในเฟสนี้ — บอกได้ถ้าอยากเพิ่ม)

## คำถามที่ยังเปิดอยู่ (ขอยืนยันก่อนลงมือ)
1. ใครเป็นคน **assign สิทธิ์ `dept_admin`** ให้ใคร — global admin เท่านั้น ใช่ไหม? (จะเพิ่มหน้าใน `/admin/settings` ให้)
2. สมาชิกหน่วยงาน (ที่ไม่ใช่ admin) ควร **เห็น Skill ทุกตัว** ของหน่วยงาน หรือเฉพาะที่ `status=active`?
3. Agent ของหน่วยงาน A ควรเรียก KB ได้ทุก category หรือจำกัดเฉพาะ category ที่ admin หน่วยงานเลือก?
