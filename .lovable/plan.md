# Open Agent Framework — Model-Agnostic Layer

ทำให้ระบบ Agent & Skills รองรับโมเดลหลายค่าย (โมเดลไทย/อธิปไตย/พาณิชย์) โดยหน่วยงาน เลือกและจัดการ provider ของตัวเองได้ พร้อม fallback chain ที่ทนทาน

## 1. Provider Registry (DB)

ตารางใหม่ `dept_model_providers` (ระดับหน่วยงาน, dept admin จัดการ):
- `dept_id`, `name` (ชื่อแสดง), `kind` enum: `lovable` | `openai_compatible` | `typhoon` | `hiclaw`
- `base_url`, `model_id` (เช่น `typhoon-v2-70b-instruct`, `openthaigpt-1.5-72b`)
- `api_key_secret_name` — เก็บแค่ "ชื่อ secret" (เช่น `DEPT_FINANCE_TYPHOON_KEY`); ค่าจริงอยู่ใน Lovable Cloud secrets ไม่เก็บในตาราง
- `price_in_per_mtok`, `price_out_per_mtok` (numeric, สำหรับ cost tracking)
- `enabled` boolean, `sort_order`

ตารางใหม่ `dept_model_routes` (fallback chain):
- `dept_id`, `name` (เช่น "Default", "Sovereign-first")
- `is_default` boolean — 1 route ต่อ dept
- `chain` jsonb: array ของ `{provider_id, on_error: ["429","5xx","timeout"]}` เรียงตามลำดับลอง

แก้ตารางเดิม:
- `dept_skills.model` → ใช้เก็บ `route_name` หรือ `provider_id` (เปลี่ยน semantics; รองรับ legacy string ของ Lovable model id)
- `dept_agents.default_model` → เหมือนกัน
- `departments` (หรือ `app_settings` ระดับ dept) เพิ่ม `default_route_id`
- `ai_runs` เพิ่ม `provider_kind`, `provider_id`, `attempts` jsonb (log ลำดับที่ลอง + error)

RLS: ทุกตารางใหม่ — SELECT/INSERT/UPDATE/DELETE เฉพาะ `is_dept_admin(auth.uid(), dept_id)`; service_role full

## 2. Provider Abstraction (Server)

ไฟล์ใหม่ `src/lib/providers.server.ts` — ฟังก์ชัน `callProvider(provider, system, user)` คืน `{text, usage}`:
- `lovable` → `ai.gateway.lovable.dev/v1` ด้วย `LOVABLE_API_KEY` + `provider.model_id`
- `openai_compatible` → `{base_url}/chat/completions` Bearer `process.env[api_key_secret_name]`
- `typhoon` → preset `https://api.opentyphoon.ai/v1` + secret
- `hiclaw` → ใช้ env `HICLAW_API_URL`/`HICLAW_API_KEY` ที่มีอยู่แล้ว (legacy)

ไฟล์ใหม่ `src/lib/model-router.server.ts` — `runWithRoute(routeChain, system, user)`:
- ลองตามลำดับ; ถ้า error match `on_error` → ลอง provider ถัดไป
- เก็บ `attempts: [{provider_id, status, latency_ms, error?}]`
- คืน `{text, usage, provider_used, attempts}`

## 3. แก้ `callAI` ให้ route-aware

`src/lib/ai.functions.ts`:
- เพิ่ม `callAIForDept(deptId, system, user, opts?: {routeName?, providerId?})` — resolve route → เรียก `runWithRoute`
- `callAI` เดิมคงไว้เป็น fallback ระบบ (Lovable default) — เผื่อ built-in agents
- คำนวณ cost จาก `provider.price_in/out_per_mtok` (override default)

แก้ `dept-agents.functions.ts` `runDeptAgent`:
- resolve model ตามลำดับ: `skill.model` → `agent.default_model` → `dept.default_route_id` → Lovable default
- เรียก `callAIForDept`; log `provider_kind/provider_id/attempts` ลง `ai_runs`

## 4. Server Functions ใหม่ (`src/lib/dept-providers.functions.ts`)

ทั้งหมด guarded ด้วย `requireSupabaseAuth` + `is_dept_admin`:
- `listDeptProviders(dept_id)`
- `upsertDeptProvider({...})` — validate base_url, kind
- `deleteDeptProvider(id)`
- `testDeptProvider(id)` — ยิง prompt สั้น ("ping") คืน latency + sample
- `listDeptRoutes(dept_id)` / `upsertDeptRoute` / `setDefaultRoute`
- `listKnownSecretNames()` — คืน list secret name ที่มี (ใช้ `secrets--fetch_secrets` ฝั่ง backend) เพื่อ dropdown

หมายเหตุ: การเพิ่ม secret ใหม่ ผู้ใช้ต้องร้องขอผ่าน flow `add_secret` ปกติ (UI แสดงคำแนะนำ); server fn อ่านได้แต่สร้างไม่ได้

## 5. UI

แก้ `/agents/manage` เพิ่มแท็บใหม่:
- **"โมเดล (Providers)"**: ตาราง list + ปุ่มเพิ่ม/แก้/ลบ + ปุ่ม "ทดสอบ" (ping)
  - Form: ชื่อ, kind (radio: Lovable / OpenAI-compatible / Typhoon / HiClaw), base_url (auto-fill ตาม kind), model_id, secret name (combobox จาก list), pricing
  - Preset templates: "OpenThaiGPT (vLLM)", "Typhoon", "Qwen via OpenRouter", "DeepSeek API", "Pathumma (Local Ollama)"
- **"Routing"**: drag-drop chain provider + เลือก route default ของหน่วยงาน + ติ๊ก error type ที่ trigger fallback

แก้ skill/agent editor:
- เปลี่ยนช่อง "model" จาก text เป็น `<Select>` แสดง: `(ใช้ค่าเริ่มต้นของหน่วยงาน)` / providers ของ dept / routes ของ dept

แก้ `/agents/manage/runs`:
- เพิ่มคอลัมน์ "Provider used" + filter
- แสดง fallback chain ที่เกิดขึ้น (badge "fallback ×2") เมื่อมี `attempts.length > 1`

## 6. Security & Validation

- Secret value ไม่เคยส่งมา client (เก็บแค่ชื่อ); resolve `process.env[name]` ใน handler
- Validate `base_url` ต้องขึ้นต้น `https://` (ยกเว้น `http://localhost` สำหรับ dev)
- Whitelist kind enum ฝั่ง DB
- Log audit: `provider.created/updated/deleted/tested`, `route.updated`
- หาก secret ไม่พบ → fail ไป fallback ถัดไปทันที และ log warning

## 7. ลำดับการทำ

1. Migration: ตาราง providers + routes + ALTER `ai_runs` + RLS + GRANT
2. `providers.server.ts` + `model-router.server.ts` + unit-test ผ่าน `testDeptProvider`
3. `dept-providers.functions.ts` + แก้ `callAI` + `runDeptAgent`
4. UI: แท็บ Providers + Routing ใน `/agents/manage`
5. ผูก skill/agent editor + runs page อัพเดทคอลัมน์
6. Seed preset templates (frontend constant — ไม่ใส่ใน DB)

## Out of Scope (รอบหน้า)

- Per-tenant rate limit / budget cap ต่อ provider
- A/B routing (สุ่ม % แบ่งโมเดล)
- Streaming responses (ตอนนี้ทั้งระบบเป็น non-stream)
- Embedding model swap (KB ยังผูก Gemini embedding)
- Marketplace แชร์ provider config ข้ามหน่วยงาน
