## เป้าหมาย

1. ย้าย 3 เมนูนี้จากแถบหลัก → กลุ่ม **ผู้ดูแลระบบ** (เห็นเฉพาะ admin):
   - Agents & Skills (`/agents`)
   - เชื่อมระบบ (`/integrations`)
   - ธรรมาภิบาล (`/governance`)
2. **ยกเลิกฟีเจอร์ Approvals ทั้งหมด** ออกจากโปรเจกต์
3. ตรวจ codebase ให้ไม่มีลิงก์/อิมพอร์ต/typegen หลงเหลือที่ทำให้บิลด์/รันพัง

## ไฟล์ที่จะแก้

### A) Sidebar — `src/components/app-sidebar.tsx`
- ลบ `/agents`, `/integrations`, `/governance`, `/approvals` ออกจาก `ITEMS` (แถบหลัก)
- เพิ่ม 3 รายการแรกเข้ากลุ่ม admin (ใช้ `AdminItem`) — Approvals ตัดทิ้ง
- ขยาย union ของ `AdminItem.to` ให้รวม `/agents | /integrations | /governance`
- เอา import `CheckCircle2` ออก (ไม่ได้ใช้แล้ว)

### B) Command palette — `src/components/command-palette.tsx`
- ลบรายการ `/approvals` ออกจากลิสต์

### C) Approvals — ถอดทั้งฟีเจอร์
- ลบไฟล์ `src/routes/_authenticated/approvals.tsx`
- ลบ server functions ใน `src/lib/ai.functions.ts`:
  - `requestApproval`, `listPendingApprovals`, `decideApproval`
  - ใน `runTemplate` ยังคงปล่อยให้ตั้ง `needs_approval` ตามนโยบาย/PII ได้ แต่ตัดเส้นทาง "ขออนุมัติ" และ workflow อนุมัติออก (เก็บแค่เป็น flag ภายในไม่มี UI)  
    *(หรือถ้าต้องการเอาออกสะอาด แจ้งได้ในขั้น build — ค่า default คือเก็บคอลัมน์ DB ไว้เพื่อไม่ต้องทำ migration)*
- ใน `src/routes/_authenticated/run/$templateId.tsx`: ลบปุ่ม "ขออนุมัติ", state/handler ที่เรียก `requestApproval`, และ import ที่เกี่ยวข้อง
- ใน `src/routes/_authenticated/history/index.tsx`: ลบ badge `requestApproval` (แสดงสถานะปกติแทน)
- ใน `src/routes/_authenticated/admin/dashboard.tsx`: ลบ KPI "Pending approvals" (และ field `pendingApprovals` ใน `src/lib/admin.functions.ts` query)
- ใน `src/lib/admin.functions.ts`: เอา query `approvals` ออก, ลบ field `pendingApprovals` จาก return
- ใน `src/lib/messages.ts`: ลบ keys `nav_approvals`, `approvalsTitle`, `approvalsEmpty`, `requestApproval`, `statPending` (และอัปเดต `MessageKey` ที่ใช้)

### D) Route tree
- `src/routeTree.gen.ts` จะ regenerate อัตโนมัติเมื่อไฟล์ route ถูกลบ — ไม่ต้องแก้มือ
- เก็บไฟล์ route `/agents`, `/integrations`, `/governance` ไว้ที่เดิม (path ไม่เปลี่ยน) เพื่อไม่ต้องย้ายไฟล์ — แค่ย้าย "เมนู" ใน sidebar เท่านั้น

### E) DB
- ไม่มี migration. ตาราง `approvals` และ column `needs_approval` ยังคงอยู่แต่ไม่ถูกใช้ (ปลอดภัย, ไม่กระทบ runtime). แจ้งผู้ใช้ว่าหากต้องการล้างจริงค่อย drop ภายหลัง

## Smoke checklist หลังบิลด์
- Sidebar: หน้าหลักไม่มี Agents/Integrations/Governance/Approvals; admin เห็นทั้ง 3 ใหม่
- Command palette: ไม่มี Approvals
- Run page: ไม่มีปุ่มขออนุมัติ, ไม่มี import ค้าง
- History: render ปกติ ไม่มี badge อนุมัติ
- Admin dashboard: KPI โหลดไม่ error
- `tsc` ผ่าน (ไม่มี import/type หลงเหลือของ approvals)
