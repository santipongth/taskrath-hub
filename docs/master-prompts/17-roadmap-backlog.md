# 17 — Roadmap & Backlog

> สิ่งที่ **ยังไม่ทำ** พร้อมเหตุผล / ตัวเลือกที่เคยตัดสินใจ — กันการเสนอซ้ำหรือทำผิดทิศ

## ตัดสินใจแล้ว (ไม่ทำในรอบนี้)

### Chat
- ❌ **Voice input** — เพิ่มภายหลัง (phase 2)
- ❌ **File attachment ใน chat** — ใช้ KB upload (admin) แทน
- ❌ **Share thread กับเพื่อนร่วมงาน** — privacy/RLS complexity
- ❌ **Export thread เป็น PDF** — ใช้ export ของ run แทน

### Signatures
- ❌ **PKI / TDID / NRCA จริง** — ต้อง HSM/USB token, ไม่เหมาะ web
- ❌ **Co-sign / multi-signer workflow** — เลือก "เจ้าของเซ็นเองคนเดียว"
- ❌ **Hash-based PAdES-lite** — เลือก "ลายเซ็นภาพ + QR" (เบื้องต้น) แทน
- ปัจจุบัน: ลายเซ็นภาพ + SHA-256 + QR → verify page

### Templates
- ❌ **Template versioning** — เลือก "CRUD พอ ไม่ต้อง version"
- ✅ **Built-in + Custom พร้อมกัน** — built-in ใน templates.ts, custom ใน DB

### Auth
- ❌ **Anonymous sign-ups** — ปิด
- ❌ **Auto-confirm email** — ปิด (ผู้ใช้ confirm เอง)
- ✅ Google OAuth ผ่าน Lovable broker (default)

## Backlog ที่อาจทำ (Phase 2+)

### Compliance & Workflow
- [ ] Approval workflow ขั้นสูง (multi-step, escalation)
- [ ] Document retention policy + auto-archive
- [ ] e-Discovery / export audit log ตามช่วงเวลา
- [ ] PDPA: data subject access request (DSAR) tooling
- [ ] e-CMS integration (สารบรรณอิเล็กทรอนิกส์)

### AI / Engine
- [ ] รองรับหลาย model (เลือกจาก dropdown: gemini-pro / claude / gpt-4)
- [ ] Fine-tune system prompts per agency
- [ ] Tool calling — เช่น "ค้นในระบบสารบรรณ", "ดูสถานะหนังสือ"
- [ ] Agent workflow (multi-step task)
- [ ] Cost budget per user/department + hard cap

### KB
- [ ] Re-ranking (hybrid bm25 + vector)
- [ ] Auto-categorize doc ตอน upload
- [ ] Versioning ของ KB doc (ระเบียบมีการแก้ไข)
- [ ] OCR สำหรับ scan PDF
- [ ] Multilingual KB (ไทย/อังกฤษ)

### Templates
- [ ] Template marketplace ข้ามหน่วยงาน
- [ ] Conditional fields (if X then show Y)
- [ ] Field validation rules (regex, range)
- [ ] Template version + rollback

### Signatures
- [ ] Co-sign (signing order)
- [ ] Hash-based PAdES (เก็บ hash ใน metadata PDF)
- [ ] PKI integration (TDID, NRCA) — ต้องการ HSM
- [ ] Bulk sign (เซ็นทีละหลายเอกสาร)
- [ ] Revocation list

### UI/UX
- [ ] Native mobile (React Native หรือ PWA install)
- [ ] Dark mode polish (มี token แล้ว แต่ทดสอบ component ครบ)
- [ ] Keyboard shortcuts ครบ + cheatsheet
- [ ] Command palette: action ครบทุกหน้า

### Integrations
- [ ] e-Mail (Gmail/Outlook) → ดึง subject/content ตอบกลับด้วย AI
- [ ] LINE OA reply bot
- [ ] DGA / GovChannel API
- [ ] Microsoft Teams / Google Chat notification
- [ ] Calendar (Google/Outlook) → สรุปประชุมจาก event

### Admin / Observability
- [ ] Cost forecast / budget alert
- [ ] User leaderboard (use case)
- [ ] Per-template success rate (อนุมัติ vs reject)
- [ ] Error rate dashboard (gateway 429/402)
- [ ] Slow query / slow run alerts

## หลักคิดก่อนเพิ่มฟีเจอร์ใหม่
1. **มี user จริงร้องขอ?** — ไม่ใช่แค่ "น่าจะดี"
2. **เข้ากับ pillar 1 ใน 5 อย่างชัดเจน?** — Templates / Freeform / KB Chat / Export / Governance
3. **ไม่เพิ่ม security surface ที่ unmanaged?** — RLS, PII, prompt-guard ต้องครอบคลุม
4. **มี migration path ของ data?** — ถ้าเปลี่ยน schema ต้อง backward compat
5. **i18n รองรับ?** — เพิ่ม key ทั้ง TH และ EN
