# แผนยกระดับ TaskRath ให้ "ใช้งานได้จริง" + UX ที่ผู้ใช้รัก

ภาพรวมความสมบูรณ์ปัจจุบัน: เรามี Templates 14+ ตัว, Run/History/Approval, Favorites, Export PDF/DOCX (ฟอนต์ Sarabun), Executive Dashboard, Agency Settings, Admin Usage, LINE Notification, OCR, PII guard, Prompt-injection guard

ยังขาดอะไรเพื่อให้ "ทำงานได้จริง" และ "ผู้ใช้ชอบ" → แบ่งเป็น 3 ระลอก เลือกทำตามลำดับความสำคัญ

---

## ระลอก A — ใช้งานได้จริงในงานประจำวัน (must-have)

### A1. Streaming output (พิมพ์ทีละตัวอักษรแบบ ChatGPT)
ตอนนี้รอจนเสร็จทั้งก้อนแล้วค่อยโชว์ → ผู้ใช้รู้สึกช้า/ค้าง
- เปลี่ยน `runTemplate` เป็น server route แบบ SSE หรือ ReadableStream
- หน้า run แสดงข้อความค่อย ๆ ขึ้น + ปุ่ม Stop
- เพิ่ม skeleton + เวลาเฉลี่ย/คาดการณ์

### A2. Refine & Iterate ผลลัพธ์ (แก้ในที่)
หลังได้ผลลัพธ์ ให้กดปุ่ม: "ทางการขึ้น", "สั้นลง", "แก้คำผิด", "เปลี่ยนน้ำเสียง", หรือพิมพ์คำสั่งเอง
- ผลลัพธ์ใหม่อ้างอิงผลเดิม (chain) เก็บเป็น versions ใน `ai_runs.metadata`
- ปุ่ม Undo/เปรียบเทียบ diff สองเวอร์ชัน

### A3. Editor ก่อน Export
ตอนนี้ผลลัพธ์เป็น read-only → ส่วนใหญ่ผู้ใช้ต้อง copy ไป Word
- ใส่ rich-text editor (tiptap) แก้ได้ในเว็บ บันทึกกลับเข้า run
- Export PDF/DOCX ใช้เวอร์ชันที่แก้แล้ว

### A4. Save Draft อัตโนมัติ + Resume
หน้า run ถ้ารีเฟรช ข้อมูลในฟอร์มหาย
- localStorage autosave ทุก field ตาม `templateId`
- Banner "พบฉบับร่างค้างไว้ — กู้คืน?"

### A5. ค้นหาประวัติ + ฟิลเตอร์
History ตอนนี้เป็นตารางไม่มีค้นหา
- ช่องค้นหา (title/output), ฟิลเตอร์ template, ช่วงวันที่, สถานะ
- pagination (เกิน 1000 rows limit ของ Supabase)

---

## ระลอก B — UX ที่ทำให้ผู้ใช้ชอบ

### B1. Command Palette (⌘K)
กด Ctrl/⌘+K → ค้นหาเทมเพลต, รัน, ดูประวัติ, เปลี่ยนหน้า, ลงชื่อออก
- ใช้ `cmdk` (มี `Command` component ของ shadcn อยู่แล้ว)

### B2. Keyboard Shortcuts
- `⌘+Enter` รัน, `⌘+S` save draft, `⌘+E` export, `⌘+/` shortcuts help
- Tooltip โชว์ shortcut ทุกปุ่มหลัก

### B3. Empty states + Onboarding
- หน้าแรกของผู้ใช้ใหม่: 3-step welcome tour
- Empty state ของ History/Favorites มีภาพ + CTA "ลองรันเทมเพลตแรก"

### B4. Loading & Micro-interactions
- Skeleton ทุกหน้า, optimistic toggle favorite (มีแล้วแต่เช็ก animation)
- Confetti เล็ก ๆ เมื่อ approval ผ่าน
- Sound toggle (ปิดได้) เมื่อ run เสร็จ

### B5. Toast → Inline status ที่ละเอียดขึ้น
- โชว์ใช้ token / cost / เวลา หลัง run แต่ละครั้ง
- บอกชัดเจนถ้าโดน prompt-guard block + ลิงก์อ่านเหตุผล

### B6. Dark/Light/System theme + ขนาดตัวอักษร
- หน่วยงานเยอะวัยมาก → slider ปรับ font 100/115/130%

### B7. Mobile-friendly polish
ส่วน Admin/History ตอนนี้ดีบนเดสก์ท็อปแต่บีบบน mobile
- Card layout แทนตารางบน <md
- Bottom nav สำหรับ mobile

---

## ระลอก C — Production-readiness (ความน่าเชื่อถือ)

### C1. Email notification เต็มรูปแบบ
- ตั้งค่า email domain (ขอ user ยืนยัน) → ส่งเมล: approval requested/approved/rejected, run shared
- Template อีเมลภาษาไทยพร้อมโลโก้หน่วยงาน

### C2. Share & Collaborate
- ปุ่ม "แชร์ลิงก์ดูอย่างเดียว" บน run (token-based, expire ได้)
- Comment thread บน run สำหรับให้หัวหน้าเสนอแก้

### C3. Team workspace / แผนก
- Profile มีคอลัมน์ `department` แล้ว → ใช้กรอง history และ dashboard ตามแผนก
- Admin invite ผู้ใช้ใหม่ผ่านอีเมล (magic link)

### C4. Template library ขยาย + Admin Editor
- หน้า Admin → สร้าง/แก้เทมเพลตเองในฐานข้อมูล (ไม่ต้อง deploy)
- Import/Export เทมเพลตเป็น JSON
- เทมเพลตเพิ่มที่ขอบ่อย: คำสั่งแต่งตั้ง, ประกาศจัดซื้อจัดจ้าง, บันทึกขออนุมัติเดินทาง, รายงานการตรวจสอบภายใน

### C5. Rate limit, Quota, Cost guard
- จำกัด runs/วัน ต่อผู้ใช้ (กันรั่ว)
- Admin ตั้ง monthly budget ต่อแผนก → เตือนเมื่อเกิน 80%

### C6. Audit log viewer + Export CSV
- ตอนนี้ `audit_logs` บันทึกแล้วแต่ดูไม่ได้ → หน้า /admin/audit

### C7. Backup & Data retention
- Auto-archive runs เก่ากว่า N เดือนเป็น JSON ใน Storage
- ปุ่ม "Export ข้อมูลของฉันทั้งหมด" ตาม PDPA

### C8. Accessibility (WCAG AA)
- aria-labels, focus rings, keyboard nav, contrast check ทุกหน้า
- จำเป็นต่อระบบราชการ (ตามมาตรฐาน TWCAG 2.0)

---

## ขอเลือก / ยืนยัน

1. เริ่มที่ระลอก A ทั้งก้อนเลย (Streaming + Refine + Editor + Autosave + Search) ใช่ไหม? หรือเลือกเฉพาะข้อ?
2. ระลอก B อยากได้ทั้งหมด หรือเอาเฉพาะ Command Palette + Shortcuts + Mobile polish (3 อันที่ impact สูงสุด)?
3. ระลอก C: ข้อ C1 (Email) ต้องการเปิด domain เลยมั้ย? C4 (Admin Template Editor) สำคัญแค่ไหน?

ถ้าไม่สะดวกเลือก → ผมแนะนำลำดับ: **A1 → A3 → A4 → A5 → B1 → B7 → C5 → C1** (8 ชิ้นนี้ครอบคลุม 80% ของ UX ที่ผู้ใช้จะรู้สึกต่าง)
