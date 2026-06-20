# วิเคราะห์ Open Notebook → ปรับใช้กับ Rathcowork

Open Notebook เป็น open-source NotebookLM clone ที่เด่นเรื่อง **จัดการความรู้รอบ "notebook" เดียว** (sources + notes + chat + transformations + podcast) พร้อม privacy-first และเลือก model ได้

## 1. Mapping ฟีเจอร์ Open Notebook ↔ ของเราตอนนี้


| Open Notebook                                 | สถานะใน Rathcowork                   | ช่องว่าง                                                   |
| --------------------------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| Notebooks (workspace ต่อหัวข้อ)               | มี `user_projects` (context ข้อความ) | ยังไม่มี workspace ที่รวม sources + chats + notes          |
| Content Support (PDF, URL, audio, video, txt) | /research ดึง URL/ไฟล์ได้            | ยังไม่ persistent เป็น "source library", ไม่มี audio/video |
| Chat with sources (RAG)                       | /run มี KB context                   | chat แบบ multi-turn ผูกกับ sources ของ project ยังไม่มี    |
| AI-Powered Notes                              | —                                    | ยังไม่มี note editor ที่ AI ช่วย insert/expand             |
| Transformations (pipeline ซ้ำได้บน content)   | มี Templates + Skills (เฉพาะ prompt) | ยังไม่มี "apply transformation to source" แบบ reusable     |
| Search & Ask (full-text + vector)             | —                                    | ยังไม่มี semantic search ข้าม sources                      |
| Podcast Generator (TTS หลายเสียง)             | —                                    | ไม่มีเลย                                                   |
| Multi-model provider                          | ใช้ Lovable AI (Gemini)              | OK แล้ว                                                    |


## 2. ฟีเจอร์เด่นที่ "ควรหยิบมา" (เรียงตาม ROI สำหรับงานวิเทศสัมพันธ์)

### Tier A — คุ้มมาก, ต่อยอดจากของเดิมเลย

1. **Notebook/Project Workspace ที่รวมทุกอย่าง**
  ยก `user_projects` ให้กลายเป็น "Notebook" จริง: ใต้ project หนึ่งจะมี
  - Sources (URL, PDF, ไฟล์, ข้อความ) — เก็บถาวร
  - Notes (markdown + AI assist)
  - Chats (หลาย session ผูก project)
  - Research runs (history)
   ทุก feature เดิม (/run, /research) เลือก project ได้อยู่แล้ว → แค่เพิ่มหน้า `/projects/$id` เป็น hub
2. **Source Library + Re-use**
  ตอนนี้ /research ดึงลิงก์/ไฟล์แบบ one-shot แล้วทิ้ง — เปลี่ยนให้ **save เป็น source** ใน project แล้วใช้ซ้ำได้ใน /run, สรุปใหม่, แปล, เขียน PR โดยไม่ต้อง scrape ใหม่ (ประหยัด Firecrawl credit ด้วย)
3. **Transformations (reusable AI pipelines บน source)**
  ตอนนี้ Skills = system prompt อย่างเดียว ผู้ใช้ต้องวาง input เอง
   เพิ่มแนวคิด "Transformation" = Skill + กดปุ่มเดียวให้ run บน source ใด ๆ
   ตัวอย่างที่ตรงงานวิเทศ: "สรุป 5 บรรทัด", "แปลเป็นไทยทางการ", "ดึง deadline + คุณสมบัติทุน", "ร่างหนังสือเชิญจากเอกสารนี้"
   ผลลัพธ์เก็บเป็น Note ผูก source
4. **Search & Ask (semantic search ข้าม sources)**
  ทำ embedding (Gemini embeddings ผ่าน Lovable AI) ของ sources + notes เก็บใน `pgvector`
   เพิ่ม `/ask` หรือช่อง search global → ตอบพร้อม citation ลิงก์ไป source
   อันนี้คือสิ่งที่ทำให้ "หาทุนเก่าที่เคยอ่าน" หรือ "เอกสาร MOU ปีก่อน" เจอได้จริง

### Tier B — เพิ่มมูลค่าชัดเจน

5. **AI-Powered Note Editor**
  markdown editor + slash command (`/expand`, `/translate`, `/summarize`, `/cite source`) ที่เรียก skill บน selection
   เหมาะกับงานเขียนข่าว/PR/หนังสือราชการที่ต้อง iterate
6. **Chat with Notebook (multi-turn, cited)**
  ตอนนี้ /run เป็น one-shot. เพิ่ม chat session ที่ context = sources ของ project + ตอบพร้อม citation `[1]`, `[2]` ลิงก์ source
   ใช้ pattern เดียวกับ NotebookLM

### Tier C — ของเล่นที่ "ว้าว" แต่ priority รอง

7. **Audio Brief Generator**
  ใช้ Lovable AI TTS สรุป notebook เป็น audio brief 3–5 นาที (เสียงเดียวพอเริ่มต้น, ไม่ต้องสองคนคุยกันเหมือน NotebookLM)
   เหมาะฟังระหว่างเดินทาง/ก่อนประชุม
8. **Citations แบบ inline บนทุก AI output**
  ทุกคำตอบที่ใช้ source ต้องมี `[n]` ชี้กลับ source — เพิ่มความน่าเชื่อถือสำหรับใช้งานในมหาวิทยาลัย
9. Multi-provider switcher (Anthropic/OpenAI/Ollama ฯลฯ) 

## 4. แผน implement แนะนำ (เป็นเฟส, ไม่ลงมือจนกว่าจะอนุมัติ)

**Phase 1 — Source Library + Notebook hub** (ฐานของทุกอย่างถัดไป)

- ตาราง `sources` (project_id, kind: url|file|text|note, title, content_md, url, file_path, metadata)
- หน้า `/projects/$id` แสดง sources + notes + research history + ปุ่ม "Chat with this project"
- /research: เพิ่มปุ่ม "Save to project as source" แทนทิ้งผลลัพธ์

**Phase 2 — Transformations**

- ตาราง `transformations` (เริ่มจาก seed: สรุป, แปลไทย/อังกฤษ, ดึง deadline ทุน, ร่างหนังสือเชิญ, เขียนข่าว PR จาก source)
- ปุ่ม "Apply transformation" บน source card → ผลลัพธ์เก็บเป็น note

**Phase 3 — Semantic Search & Ask**

- เปิด `pgvector`, ตาราง `source_embeddings`
- Background job ตอน save source → chunk + embed
- หน้า `/ask` รับคำถาม → top-k retrieval → ตอบพร้อม citation

**Phase 4 — AI Note Editor + Chat with Notebook**

- Markdown editor (tiptap หรือ react-markdown + textarea) + slash commands
- Chat session ผูก project, ใช้ retrieval จาก Phase 3

**Phase 5 — Audio Brief (optional)**

- ปุ่ม "Generate audio brief" บน project → Lovable AI TTS → เก็บใน Lovable Cloud Storage
- Multi-provider switcher

## 5. คำถามก่อนเริ่ม

- เริ่มจาก **Phase 1 (Source Library + Notebook hub)** ตามแผน หรืออยากให้ priority Phase อื่นก่อน? ตอบ: โอเค
- ฟีเจอร์ **Audio brief** ต้องการไหม หรือข้ามเลย? ตอบ:เป็น **Audio brief**
- ต้องการ **citations แบบ inline** `[1][2]` บนทุก AI output ทั้งแอป (รวม /run, /research เดิม) หรือเฉพาะ chat ใหม่? ตอบ:ทำบนทุก ทั้งแอป (รวม /run, /research เดิม) และ chat ใหม่ด้วย 