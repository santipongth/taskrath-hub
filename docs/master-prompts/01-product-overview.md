# 01 — Product Overview

## ชื่อ
**TaskRath** (ทาสก์-รัฐ) — *AI assistant for government work*

## วิสัยทัศน์
ทำให้เจ้าหน้าที่รัฐทำงานเอกสาร/วิเคราะห์/ตอบคำถามระเบียบได้เร็วและถูกระเบียบ ด้วย AI ที่เข้าใจบริบทราชการไทยและอ้างอิงเอกสารจริงจาก KB ของหน่วยงาน

## กลุ่มผู้ใช้
1. **เจ้าหน้าที่ปฏิบัติการ** — ร่างหนังสือ สรุปประชุม ตอบข้อร้องเรียน
2. **หัวหน้างาน / ผู้บริหาร** — ดู dashboard การใช้งาน อนุมัติเอกสารที่ต้องการ approval
3. **Admin หน่วยงาน** — จัดการ KB, custom templates, agency settings (ตราครุฑ, ลายเซ็น), แจ้งเตือน LINE
4. **ประชาชน / ผู้รับเอกสาร** — เปิดหน้า `/verify/{id}` สแกน QR ตรวจสอบลายเซ็นดิจิทัล

## Pillars หลัก
1. **Templates Library** — เทมเพลตสำเร็จรูปตามระเบียบสารบรรณ + admin เพิ่มเองได้
2. **Freeform Run** — สั่งงาน AI อิสระ มี refine loop
3. **KB + Chat (RAG)** — อัปโหลดระเบียบ → ถาม-ตอบหลายเทิร์น พร้อม citations
4. **Export ราชการ** — PDF/DOCX มีตราครุฑ ชั้นความลับ เลขที่หนังสือ ลายเซ็นดิจิทัล + QR
5. **Governance** — audit log, PII redaction, prompt injection guard, approval workflow, executive stats

## Domain ราชการไทยที่ระบบรู้
- ระเบียบสำนักนายกฯ ว่าด้วยงานสารบรรณ พ.ศ. 2526
- พ.ร.บ.ธุรกรรมทางอิเล็กทรอนิกส์ (มาตรา 9 — ลายมือชื่ออิเล็กทรอนิกส์)
- ระเบียบจัดซื้อจัดจ้าง (TOR)
- แบบ ปย.1/ปย.2 (ควบคุมภายใน)
- กพร. (รายงานการประชุม)
- คำของบประมาณ
- ชั้นความลับ: ปกติ / ลับ / ลับมาก / ลับที่สุด
- ชั้นความเร็ว: ด่วน / ด่วนมาก / ด่วนที่สุด

## URLs
- Preview: `https://id-preview--ddcb42ef-2992-4000-9584-e6727598a573.lovable.app`
- Published: `https://taskrath-hub.lovable.app`

## ขอบเขตที่ไม่ทำ (ปัจจุบัน)
- Voice input ใน chat
- File attachment ใน chat
- Share thread กับผู้อื่น
- Co-sign / multi-signer workflow
- PKI / TDID จริง (มีแต่ลายเซ็นภาพ + hash + QR)
- Template versioning
- Native mobile apps
