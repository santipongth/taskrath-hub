# 08 — Core Engine: AI (`src/lib/ai.functions.ts`)

## หน้าที่
- เรียก Lovable AI Gateway (OpenAI-compatible)
- รองรับ streaming
- ใส่ PII redaction + prompt-injection guard ก่อนส่ง
- ดึง KB context (RAG) เมื่อมี
- log ลง `ai_runs` + `audit_logs` หลังเสร็จ
- แจ้ง LINE (optional) หลังเสร็จ

## Endpoint & Model
```ts
const URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash"; // default
const KEY = process.env.LOVABLE_API_KEY!;  // server-only
```
Headers: `Authorization: Bearer ${KEY}`, `Content-Type: application/json`

## Pricing (อยู่ใน `ai.functions.ts`)
```ts
const PRICE_IN_PER_MTOK = 0.3;
const PRICE_OUT_PER_MTOK = 2.5;  // USD per 1M tokens (gemini-2.5-flash)
function calcCost(p: number, c: number) {
  return (p / 1e6) * PRICE_IN_PER_MTOK + (c / 1e6) * PRICE_OUT_PER_MTOK;
}
```

## Template Prompts (built-in)
มี `TEMPLATE_PROMPTS: Record<string,string>` map `templateId → system prompt ภาษาไทย`
- ครอบคลุม template ใน `templates.ts` ทั้งหมด
- custom_templates: เก็บ system prompt ในแถวเอง

## KB Instruction (เมื่อมี context)
```ts
const KB_INSTRUCTION =
  "หากใช้ข้อมูลจาก <ระเบียบที่เกี่ยวข้อง> ให้อ้างอิงในรูปแบบ [หมายเลข] ท้ายประโยคที่เกี่ยวข้อง ห้ามแต่งข้อกฎหมายเอง หากไม่พบข้อมูลที่ตรงให้ระบุไว้";
```
ฟังก์ชัน `withKbContext(systemPrompt, ctx)` จะแปะ block:
```
<ระเบียบที่เกี่ยวข้อง>
[1] {title} — {snippet}
[2] ...
</ระเบียบที่เกี่ยวข้อง>
{KB_INSTRUCTION}
```

## Pipeline เรียก AI (run / freeform)
1. `requireSupabaseAuth` (Bearer attach อัตโนมัติ)
2. parse input ด้วย `zod`
3. `redactPII(combined)` → ได้ `{ text, map, counts }`
4. `checkPromptInjection(text)` → ถ้า `decision === "block"` throw
5. (ถ้าเป็น run ที่ต้องใช้ KB) `retrieveKbContext({query: text, k: 5, category})`
6. compose `{ system, user }` → call gateway with `stream: true`
7. stream กลับ client (text chunks)
8. `onFinish`:
   - `restorePII(output, map)` → คืน PII ในผลลัพธ์
   - insert `ai_runs` (`prompt_tokens`, `completion_tokens`, `cost_usd`, `template_id`, `status`, `needs_approval`)
   - insert `audit_logs`
   - ถ้า `needs_approval`: insert `approvals` row + `notifyEvent("approval", ...)`
   - else: `notifyEvent("complete", ...)`

## Refine Loop
- `refineRun({ runId, instruction })` → ใช้ผลลัพธ์เดิมเป็น context + คำสั่งแก้
- ใช้ใน `<RefineBar />`

## Status Codes ที่ Gateway คืน
- `429` → "Rate limit exceeded — please try again shortly."
- `402` → "AI credits exhausted."
- non-2xx อื่น → throw with body

## Helper Functions ในไฟล์
- `checkIsAdmin()` — เช็ค role (ใช้ใน sidebar)
- `notifyEvent(supabase, event, text)` — push LINE
- `assertAdmin(supabase, userId)` — throw ถ้าไม่ใช่ admin

## ตัวอย่าง shape ของ serverFn streaming
```ts
export const runTemplate = createServerFn({ method: "POST", response: "raw" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    templateId: z.string().min(1).max(120),
    fields: z.record(z.string(), z.string()).default({}),
    useKb: z.boolean().default(true),
    category: z.string().nullable().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    // 1. resolve system prompt (built-in หรือ custom)
    // 2. redact + guard + RAG
    // 3. fetch gateway with stream: true
    // 4. return new Response(stream, { headers: { "content-type": "text/event-stream" }})
  });
```

## ข้อห้าม
- อย่าใส่ API key ใน client
- อย่าใส่ raw user input เข้า system prompt โดยตรง (ใช้ user role)
- อย่าลืม `redactPII` ก่อนส่ง (เป็น compliance requirement)
- อย่า log raw content ลง `audit_logs` (ใส่ metadata + token usage พอ)
