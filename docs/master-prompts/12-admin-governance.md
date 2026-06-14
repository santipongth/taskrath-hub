# 12 — Admin & Governance

## หน้า Admin (เข้าได้เฉพาะ `has_role('admin')`)

### `/admin/dashboard` — Executive Stats
แสดงผลจาก `executiveStats({ days: 30 })` ใน `admin.functions.ts`:
- ยอดรวม: runs, costUsd, tokens, activeUsers, avgCost
- กราฟ runs ต่อวัน (line chart)
- top departments (bar)
- top templates (bar)

### `/admin/usage`
breakdown ระดับผู้ใช้/วัน (เผื่อ export CSV)

### `/admin/knowledge`
- รายการ `kb_documents` + สถานะ embedding
- อัปโหลด: PDF/DOCX/TXT → server function แตก chunk + embed → insert
- ลบ doc → cascade ลบ chunks

### `/admin/templates` — Custom Templates CRUD
ดู `10-templates-engine.md` (section B)

### `/admin/settings` — Agency Settings
- ฟอร์มกรอก name, subUnit, address, phone, email, signerName, signerPosition
- upload ตราครุฑ → bucket `agency-assets`
- save ผ่าน `updateAgencySettings()`

### `/admin/notifications`
- toggle LINE: enabled, broadcast/push, target ID
- toggle event: on_complete, on_approval
- เก็บใน `app_settings.notifications`

## Governance (สำหรับ user ทั่วไป)
### `/governance`
- แสดง audit log ของตัวเอง
- จำนวน PII ที่ปกปิด (จาก `audit_logs.metadata.pii_counts`)
- จำนวน prompt-injection blocked

## Audit Logs
schema: `id, user_id, action, resource, metadata jsonb, created_at`

`action` ที่ใช้ในระบบ (string convention):
- `ai.run` — run AI สำเร็จ
- `ai.refine` — refine
- `ai.blocked` — prompt-injection blocked
- `kb.upload` — admin upload doc
- `kb.delete`
- `template.create` / `template.update` / `template.delete`
- `agency.update`
- `signature.create`
- `approval.request` / `approval.decide`

metadata ตัวอย่าง:
```json
{ "template_id": "tor-draft", "tokens": 1250, "cost": 0.0034, "pii_counts": { "ID": 1 } }
```

## Approvals
ตาราง `approvals`: `id, run_id, requester_id, approver_id?, status (pending/approved/rejected), reason, decided_at`

Flow:
1. run AI → ถ้า `needs_approval=true` → insert approval (pending)
2. แจ้ง LINE หา approver
3. approver กดอนุมัติ/ไม่อนุมัติ → update + audit log

`needs_approval` ตัดสินจาก:
- template ที่มี classification ≥ ลับ
- detect คำเฉพาะใน prompt (configurable)

## Notifications (LINE Messaging API)
- ใช้ `LINE_CHANNEL_ACCESS_TOKEN` (server-only)
- `notifyEvent(supabase, event, text)` ใน `ai.functions.ts`
- ทำงาน fire-and-forget — fail แล้วต้องไม่ block flow หลัก

## Access Control Pattern
ทุก admin serverFn:
```ts
.middleware([requireSupabaseAuth])
.handler(async ({ data, context }) => {
  await assertAdmin(context.supabase, context.userId); // RPC has_role
  // ... ปลอดภัยใช้ supabaseAdmin หลังจากนี้
});
```

ทุก admin route:
```tsx
beforeLoad: async ({ context }) => {
  // ใช้ checkIsAdmin() — ถ้าไม่ใช่ throw redirect ไป /
}
```
