# 14 — Security & Compliance

## Layer 1: Row Level Security (RLS)
- เปิด RLS ทุกตารางใน `public` schema (ไม่มีข้อยกเว้น)
- policy scope: ส่วนใหญ่ `auth.uid() = user_id`
- admin override: `public.has_role(auth.uid(), 'admin')` (SECURITY DEFINER)
- service role bypass: เฉพาะ `supabaseAdmin` ใน server-only paths
- ห้ามมี policy `using (true)` กว้าง ๆ กับ `authenticated` (ยกเว้น reference data)

## Layer 2: GRANT
ตาราง public ต้องมี GRANT ตรงๆ ในทุก migration (ดู `07-database-schema.md`)
- default: `grant select, insert, update, delete ... to authenticated`
- + `grant all to service_role` (สำหรับ admin/edge work)
- เพิ่ม `to anon` เฉพาะตารางที่ตั้งใจให้ public เห็น (เช่น `signed_documents` สำหรับ verify)

## Layer 3: serverFn Authorization
ทุก privileged operation ต้อง:
```ts
.middleware([requireSupabaseAuth])  // ตรวจ token
.handler(async ({ context }) => {
  await assertAdmin(context.supabase, context.userId); // ตรวจ role
  // ...
})
```
- ห้ามมี serverFn ที่ไม่มี `requireSupabaseAuth` ที่ทำ write privileged
- ห้ามใช้ user input เป็น role check (`role: input.role` ← antipattern)

## Layer 4: PII Redaction (`src/lib/pii.ts`)
ทำก่อนส่ง text เข้า AI gateway:
```ts
const { text, map, counts } = redactPII(userInput);
// text → ส่งเข้า AI
// หลังได้ output: restorePII(output, map)
```

ตรวจจับ:
- เลขบัตรประชาชนไทย 13 หลัก (มี checksum)
- email
- เบอร์โทรศัพท์ไทย (+66 หรือ 0XX)
- เลขบัญชี (10–14 หลักติดกัน)

token format: `[ID_1]`, `[EMAIL_1]`, `[PHONE_2]`, `[ACCT_1]`

## Layer 5: Prompt Injection Guard (`src/lib/prompt-guard.ts`)
heuristic 0–100 + decision:
- `>= 70` → **block** (throw)
- `>= 40` → **warn** (log แต่ส่งต่อได้)
- `< 40` → allow

ดักทั้งภาษาไทย/อังกฤษ: "ignore previous", "DAN", "reveal prompt", "ละเว้นคำสั่ง", "แสดง prompt"

## Layer 6: Auth Provider Setup
- Email + password (default)
- Google OAuth ผ่าน **Lovable broker เท่านั้น**:
  ```ts
  import { lovable } from "@/integrations/lovable";
  await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
  ```
- ห้าม `supabase.auth.signInWithOAuth("google", ...)` ตรง ๆ
- ห้ามเปิด anonymous sign-ups
- ห้าม auto-confirm email (ยกเว้นผู้ใช้ขอ)

## Layer 7: Secrets
| Secret | อยู่ที่ |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | server env เท่านั้น — เปิดผ่าน `client.server.ts` ใน handler |
| `LOVABLE_API_KEY` | server env, AI gateway |
| `LINE_CHANNEL_ACCESS_TOKEN` | server env |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | OK ใน client (publishable) |

- ห้าม log secret
- ห้าม return secret ใน response
- Lovable Cloud users **ไม่มี** dashboard access — service role key ไม่สามารถ fetch ได้

## Compliance — ระเบียบ/กฎหมายที่ระบบรับรู้

### ระเบียบสำนักนายกฯ ว่าด้วยงานสารบรรณ พ.ศ. 2526
- หัวกระดาษราชการ (ตราครุฑ, ที่, วันที่, เรื่อง, เรียน)
- ชั้นความลับ: ปกติ / ลับ / ลับมาก / ลับที่สุด
- ชั้นความเร็ว: ปกติ / ด่วน / ด่วนมาก / ด่วนที่สุด
- การลงนาม + ตำแหน่ง

### พ.ร.บ.ธุรกรรมทางอิเล็กทรอนิกส์ พ.ศ. 2544 (แก้ไข 2562)
- **มาตรา 9**: ลายมือชื่ออิเล็กทรอนิกส์ที่ใช้วิธีการที่เชื่อถือได้
- ระบบทำ:
  - ภาพลายเซ็น (intent ของผู้เซ็น)
  - SHA-256 hash ของเนื้อหา (integrity)
  - QR + verify URL (verifiability)
  - timestamp + signer identity ใน DB
- **ไม่ใช่** PKI/CA ใบรับรองจริง — แสดงข้อความนี้ในหน้า verify

### พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA)
- PII redaction บังคับก่อนส่ง AI
- audit log เก็บ counts ไม่เก็บค่า raw
- user เห็นเฉพาะข้อมูลของตัวเอง (RLS)

## Security Memory
- ถ้า scanner เจอ finding ที่ตั้งใจ ignore → update `@security-memory`
- ห้ามรายการ open findings ใน memory (เก็บ guidance อย่างเดียว)

## Audit Checklist ก่อน Deploy
- [ ] ทุกตารางใหม่: CREATE + GRANT + ENABLE RLS + POLICY ครบ
- [ ] ไม่มี service role key ใน client bundle
- [ ] ทุก admin route + serverFn: role check
- [ ] ทุก AI call: PII redact + prompt-guard
- [ ] webhook (ถ้ามี): signature verify ก่อน read body
