# วิเคราะห์ Feature จาก Odysseus → RathCoWork

Odysseus เป็น self-hosted AI workspace (local LLM, single-user/team) ส่วน RathCoWork เป็น SaaS สำหรับหน่วยงานราชการไทย (multi-tenant, governance-first, RLS, audit, signature) — ปรัชญาต่างกัน แต่มีหลาย feature ที่ "เข้า pillar" ของเราชัดเจน

## Feature ที่ "ควรหยิบมาทำ" (High fit)

### 1. Compare — ส่งคำสั่งเดียวเทียบหลายโมเดลพร้อมกัน

- **เหตุผล**: เราเพิ่งเปิด `dept_model_providers` ให้ admin หน่วยงานเลือก provider/model ได้แล้ว → ต่อยอดเป็นโหมด "เทียบผลก่อนเลือกใช้" บนหน้า `/run`
- **ตรงกับ backlog ข้อ**: "รองรับหลาย model (เลือกจาก dropdown)" ใน 17-roadmap-backlog.md → ยกระดับเป็น side-by-side
- **ขอบเขต**: เพิ่มปุ่ม "Compare" บน `/run` รัน prompt เดียวกับ 2–3 routes ที่ admin อนุญาต, แสดงคอลัมน์, log เป็น 1 run group, นับ cost รวม

### 2. Deep Research — ค้นหา + อ่าน + สรุปเป็นรายงานพร้อม citation

- **เหตุผล**: เข้ากับ pillar "KB Chat" + workflow ราชการ (ทำสรุประเบียบ, เปรียบเทียบกฎหมาย)
- **ใช้ Firecrawl connector (มีอยู่แล้วในเอกสาร) + Lovable AI gateway**
- **ขอบเขต MVP**: route `/research` รับโจทย์ → plan ขั้นตอน → Firecrawl search/scrape → สรุป markdown พร้อม citation [n] → save เป็น run ปกติ (re-use export/signature pipeline)

### 3. Memory ระดับ user — บริบทที่ผู้ใช้สะสมข้ามการสนทนา

- **เหตุผล**: คนทำงานราชการคนเดิมเขียนรูปแบบหนังสือคล้ายเดิม (ตำแหน่ง, หน่วยงาน, สำนวน) → ลดการพิมพ์ซ้ำ
- **ขอบเขต**: table `user_memory(user_id, key, value, updated_at)` + RLS เจ้าของอ่าน/เขียน, system-prompt injection ใน `runFreeform`/chat, หน้า settings ดู/ลบ
- **Governance**: log ทุกการเขียน memory, เคารพ PII guard ที่มีอยู่

4. เลือกโมเดลได้ด้วยตัวเอง



## ลำดับที่แนะนำ

1. **Compare** — เล็ก เร็ว ต่อยอดของที่มี ROI ชัด
2. **User Memory** — schema เล็ก, governance ตรงไปตรงมา, UX impact สูง
3. **Deep Research** — ต้องการ Firecrawl connector + UI ใหม่ ใหญ่กว่า 2 ข้อแรก
4. ในหน้า "สั่งงาน AI" ให้ผู้ใช้สามารถ switch เลือกโมเดลได้หลายตัว

ทำหมดทั้ง 4 ข้อ