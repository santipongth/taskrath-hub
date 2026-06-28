
## เข้าใจ Concept ใหม่

ระบบนี้ใช้งานจริงในหน่วยงานเดียว (single-tenant) — การบังคับว่าผู้ใช้ต้องตั้ง `department` ในโปรไฟล์ก่อนถึงจะเห็น/จัดการ Skill ได้ เป็นความซับซ้อนที่ไม่จำเป็น และเป็นต้นเหตุของ error "ไม่ได้กำหนดหน่วยงานในโปรไฟล์" ที่เพิ่งเจอ

แนวคิดใหม่ของเมนู "จัดการ Skill":
- Skill ที่ admin สร้าง = **คลังกลางขององค์กร** ที่ผู้ใช้ทุกคนเห็นและเรียกใช้ได้ทันที
- ไม่มี gate เรื่อง department อีกต่อไป
- สิทธิ์จัดการดูที่ "บทบาทผู้ดูแล" อย่างเดียว ไม่ใช่หน่วยงาน

## แนวทางที่แนะนำ

### 1. สิทธิ์การจัดการ Skill
- ใครเป็น `admin` **หรือ** `dept_admin` (role ใน `user_roles`) จัดการ Skill ในคลังกลางได้ทั้งหมด
- ผู้ใช้ทั่วไป (`user`) เห็นและเรียกใช้ Skill ที่ `is_active = true` ได้ทุกตัว
- ไม่ต้องเช็ค `is_in_department` / `is_dept_admin(_, dept)` อีก

### 2. ฐานข้อมูล `shared_skills`
- คอลัมน์ `department` **คงไว้** แต่ทำให้ optional (nullable, default `NULL`) ใช้เป็นแค่ tag/หมวดหมู่ในอนาคต ไม่ใช่ gate
- เขียน RLS policies ใหม่:
  - SELECT: ผู้ใช้ที่ล็อกอินทุกคน อ่าน skill ที่ `is_active = true` ได้
  - INSERT/UPDATE/DELETE: เฉพาะ `has_role(auth.uid(), 'admin')` หรือ `has_role(auth.uid(), 'dept_admin')`
- Skill เดิมที่มี `department` อยู่ ปล่อยทิ้งไว้ ไม่ลบข้อมูล (ค่ายังอยู่แต่ไม่ถูกใช้กรอง)

### 3. Server functions (`src/lib/shared-skills.functions.ts`)
- ลบ `getMyDept()` ออกจาก path ของ shared skills (ฟังก์ชันอื่นยังใช้ได้)
- `listSharedSkills` → คืน skill `is_active = true` ทั้งหมด + flag `canManage` ที่เช็คจาก role อย่างเดียว
- `listSharedSkillsForAdmin` → เช็ค role admin/dept_admin → คืน skill ทั้งหมด (รวม inactive) ไม่ผูก department
- `upsertSharedSkill` / `deleteSharedSkill` → เช็ค role อย่างเดียว, ไม่ set `department` (ปล่อย null)
- `listAvailableSkills` (ใช้ใน Run / Research) → รวม shared (active ทุกตัว) + personal skills เหมือนเดิม

### 4. หน้า UI
- `/skills` (คลัง): เอา badge หน่วยงานออก, แสดง category แทน
- `/skills/manage`:
  - ลบ block "ยังไม่ได้กำหนดหน่วยงาน" ที่เพิ่งเพิ่ม
  - ลบ field `department` ใน form (ไม่ต้องให้กรอก)
  - หัวข้อเปลี่ยนเป็น "จัดการคลัง Skill" (ตัด "หน่วยงาน" ออก)
  - เหลือกรณีเดียวที่บล็อก: `not_admin` → "เฉพาะผู้ดูแลระบบเท่านั้น"
- Skill selector ใน Chat/Run/Research: ไม่ต้องแก้ logic, แค่จะเห็น shared skill เพิ่มขึ้นเพราะไม่กรอง dept

### 5. ส่วนอื่นที่ไม่แตะ
- `dept_model_providers` / `dept_model_routes` ยังคง concept department ตามเดิม (ใช้กับ provider routing ของ AI ไม่เกี่ยวกับ skill UI)
- ฟิลด์ `profiles.department` คงไว้ ใช้ในหน้าแอดมินเดิมได้
- `is_dept_admin`, `is_in_department` คงไว้ในฐานข้อมูล

## ผลลัพธ์ที่ผู้ใช้จะเห็น
- ผู้ใช้ทุกคนเปิด `/skills` แล้วเห็นรายการ skill ที่ admin สร้างทันที โดยไม่ต้องตั้ง department
- Admin (หรือ dept_admin) กด "จัดการ" เข้าไปสร้าง/แก้/ปิดใช้ skill ได้เลย ไม่ติด error อีก
- ฟอร์มสร้าง skill เรียบขึ้น ไม่มี field/บริบทหน่วยงาน

## รายละเอียดเชิงเทคนิค (สำหรับตอน implement)

ไฟล์ที่ต้องแก้:
- `supabase/migrations/<new>.sql` — alter `shared_skills.department` ให้ nullable; drop + recreate RLS policies (4 policies → 2 policies: read-active-for-authenticated, manage-for-admin-or-dept_admin)
- `src/lib/shared-skills.functions.ts` — ตัด `getMyDept` ออกจาก code path ทั้งหมดของ shared skills, แก้ `canManage` logic, แก้ insert/update ไม่ส่ง department
- `src/routes/_authenticated/skills/index.tsx` — ตัด badge department, แก้ข้อความ
- `src/routes/_authenticated/skills/manage.tsx` — ลบ branch `no_department`, ลบ field department ใน Draft/form, เปลี่ยน title
- `src/components/app-sidebar.tsx` — เปลี่ยน label เมนูถ้าจำเป็น (จาก "จัดการ Skill หน่วยงาน" เป็น "จัดการคลัง Skill")

ลำดับงาน:
1. Migration (alter column + RLS)
2. แก้ server functions
3. แก้ UI หน้าคลังและหน้า manage
4. ทดสอบ: user ธรรมดาเห็น/เรียกใช้ได้, admin/dept_admin จัดการได้, user ที่โปรไฟล์ไม่มี department ก็ใช้งานได้ปกติ
