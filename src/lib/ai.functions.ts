import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { redactPII, restorePII, piiSummary } from "@/lib/pii";
import { checkPromptInjection } from "@/lib/prompt-guard";
import { retrieveKbContext, type Citation } from "@/lib/kb.functions";

const KB_INSTRUCTION =
  "หากใช้ข้อมูลจาก <ระเบียบที่เกี่ยวข้อง> ให้อ้างอิงในรูปแบบ [หมายเลข] ท้ายประโยคที่เกี่ยวข้อง ห้ามแต่งข้อกฎหมายเอง หากไม่พบข้อมูลที่ตรงให้ระบุไว้";

function withKbContext(systemPrompt: string, ctx: { block: string; citations: Citation[] } | null): string {
  if (!ctx) return systemPrompt;
  return `${systemPrompt}\n\n<ระเบียบที่เกี่ยวข้อง>\n${ctx.block}\n</ระเบียบที่เกี่ยวข้อง>\n\n${KB_INSTRUCTION}`;
}


type NotifSettings = {
  lineEnabled: boolean;
  lineTargetId: string;
  lineBroadcast: boolean;
  notifyOnApproval: boolean;
  notifyOnComplete: boolean;
};

async function notifyEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  event: "complete" | "approval",
  text: string,
) {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "notifications")
      .maybeSingle();
    const cfg = (data?.value as NotifSettings | null) ?? null;
    if (!cfg || !cfg.lineEnabled) return;
    if (event === "complete" && !cfg.notifyOnComplete) return;
    if (event === "approval" && !cfg.notifyOnApproval) return;
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) return;
    const messages = [{ type: "text", text: text.slice(0, 4900) }];
    const url = cfg.lineBroadcast
      ? "https://api.line.me/v2/bot/message/broadcast"
      : "https://api.line.me/v2/bot/message/push";
    const payload = cfg.lineBroadcast ? { messages } : cfg.lineTargetId ? { to: cfg.lineTargetId, messages } : null;
    if (!payload) return;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch {
    /* notification failure must never block the calling flow */
  }
}

const TEMPLATE_PROMPTS: Record<string, string> = {
  "meeting-summary": "คุณเป็นเลขานุการที่ปรึกษาด้านการประชุมราชการ จงสรุปการประชุมในรูปแบบทางการ มีหัวข้อ: วาระ, ประเด็นสำคัญ, มติที่ประชุม, และผู้รับผิดชอบ",
  "external-letter": "คุณเป็นเจ้าหน้าที่สารบรรณราชการ จงร่างหนังสือภายนอกตามระเบียบสำนักนายกรัฐมนตรีว่าด้วยงานสารบรรณ พ.ศ. 2526 ใช้ภาษาทางการ",
  "internal-letter": "จงร่างหนังสือภายในตามระเบียบงานสารบรรณ มีหัวข้อ ที่/วันที่/เรื่อง/เรียน/เนื้อหา/ลงนาม",
  "memo": "จงร่างบันทึกข้อความตามแบบฟอร์มราชการไทย ส่วนหัวประกอบด้วย ส่วนราชการ ที่ วันที่ เรื่อง เรียน",
  "budget-analysis": "คุณเป็นนักวิเคราะห์งบประมาณภาครัฐ จงวิเคราะห์ข้อมูลในมุมความสมเหตุสมผล ประสิทธิภาพ ความเสี่ยง และเสนอแนะ",
  "doc-summary": "จงสรุปเอกสารเป็นประเด็นสำคัญแบบ bullet ครอบคลุมสาระและข้อสรุป",
  "tor-draft": "จงร่าง TOR ตามระเบียบจัดซื้อจัดจ้าง ครอบคลุม ความเป็นมา วัตถุประสงค์ ขอบเขตงาน คุณสมบัติผู้เสนอ ระยะเวลา เงื่อนไขชำระเงิน",
  "appointment-order": "จงร่างคำสั่งแต่งตั้งคณะทำงาน ระบุ องค์ประกอบ อำนาจหน้าที่ และวันที่ลงนาม",
  "announcement": "จงร่างประกาศหน่วยงานราชการในรูปแบบทางการ พร้อมส่วนหัว เนื้อหา และวันที่ประกาศ",
  "complaint-reply": "จงร่างหนังสือตอบข้อร้องเรียนของประชาชน ใช้ภาษาสุภาพ ชัดเจน และระบุแนวทางดำเนินการ",
  "translate": "จงแปลเอกสารโดยรักษาความเป็นทางการ คำเฉพาะ และโครงสร้างของต้นฉบับ",
  "proofread": "จงตรวจสอบเอกสาร แก้คำผิด ไวยากรณ์ และปรับโทนให้เป็นทางการ พร้อมสรุปการแก้ไข",
  "law-summary": "จงสรุปกฎหมาย/ระเบียบเป็นภาษาเข้าใจง่าย ระบุผู้บังคับใช้ ผู้ได้รับผลกระทบ และข้อควรระวัง",
  "agenda": "จงร่างวาระการประชุมตามรูปแบบราชการไทย: วาระที่ 1 เรื่องประธานแจ้ง, วาระที่ 2 รับรองรายงานการประชุม, วาระที่ 3 เรื่องสืบเนื่อง, วาระที่ 4 เรื่องเพื่อพิจารณา, วาระที่ 5 เรื่องอื่น ๆ",
};

export type AIUsage = { promptTokens: number; completionTokens: number; costUsd: number };

// Approximate pricing (USD) per 1M tokens for google/gemini-2.5-flash.
// Refs: https://ai.google.dev/pricing (≈ $0.30 input, $2.50 output per 1M tokens).
const PRICE_IN_PER_MTOK = 0.3;
const PRICE_OUT_PER_MTOK = 2.5;

function computeCost(promptTokens: number, completionTokens: number) {
  return (promptTokens / 1_000_000) * PRICE_IN_PER_MTOK + (completionTokens / 1_000_000) * PRICE_OUT_PER_MTOK;
}

async function callAI(
  systemPrompt: string,
  userPrompt: string,
): Promise<{ text: string; usage: AIUsage }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI service not configured");

  const hiclawUrl = process.env.HICLAW_API_URL;
  const hiclawKey = process.env.HICLAW_API_KEY;
  if (hiclawUrl && hiclawKey) {
    const res = await fetch(`${hiclawUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${hiclawKey}` },
      body: JSON.stringify({
        model: process.env.HICLAW_MODEL ?? "default",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`HiClaw error ${res.status}`);
    const json = await res.json();
    const pt = json.usage?.prompt_tokens ?? 0;
    const ct = json.usage?.completion_tokens ?? 0;
    return {
      text: json.choices?.[0]?.message?.content ?? "",
      usage: { promptTokens: pt, completionTokens: ct, costUsd: 0 },
    };
  }

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (res.status === 429) throw new Error("Rate limit exceeded. Please try again shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted. Please add credits in workspace settings.");
  if (!res.ok) throw new Error(`AI error ${res.status}`);
  const json = await res.json();
  const pt = json.usage?.prompt_tokens ?? 0;
  const ct = json.usage?.completion_tokens ?? 0;
  return {
    text: json.choices?.[0]?.message?.content ?? "",
    usage: { promptTokens: pt, completionTokens: ct, costUsd: computeCost(pt, ct) },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logAudit(
  supabase: any,
  userId: string,
  action: string,
  resource: string | null,
  metadata: Record<string, unknown>,
) {
  await supabase.from("audit_logs").insert({ user_id: userId, action, resource, metadata });
}

export const runTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        templateId: z.string().min(1).max(64),
        inputs: z.record(z.string(), z.string().max(20000)),
        title: z.string().max(200).optional(),
        redactPii: z.boolean().optional().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const systemPrompt = TEMPLATE_PROMPTS[data.templateId] ?? "คุณเป็นผู้ช่วยที่เชี่ยวชาญงานราชการไทย";
    const rawUserPrompt = Object.entries(data.inputs)
      .map(([k, v]) => `${k}:\n${v}`)
      .join("\n\n");

    // Prompt injection guard
    const guard = checkPromptInjection(rawUserPrompt);
    if (guard.decision === "block") {
      await logAudit(supabase, userId, "ai.blocked", data.templateId, { reason: "injection", hits: guard.hits, score: guard.score });
      throw new Error("พบรูปแบบคำสั่งที่อาจเป็น prompt injection — ปฏิเสธการประมวลผล");
    }

    // PII redaction
    let userPromptForAI = rawUserPrompt;
    let piiMap: Record<string, string> = {};
    let piiCounts: Record<string, number> = {};
    if (data.redactPii) {
      const r = redactPII(rawUserPrompt);
      userPromptForAI = r.text;
      piiMap = r.map;
      piiCounts = r.counts;
    }

    let aiText: string;
    let usage: AIUsage;
    const kbCtx = await retrieveKbContext(supabase, rawUserPrompt);
    const systemWithKb = withKbContext(systemPrompt, kbCtx);
    try {
      const r = await callAI(systemWithKb, userPromptForAI);
      aiText = r.text;
      usage = r.usage;
    } catch (e) {
      await logAudit(supabase, userId, "ai.error", data.templateId, { error: e instanceof Error ? e.message : "unknown" });
      throw e;
    }

    const output = data.redactPii ? restorePII(aiText, piiMap) : aiText;

    const { data: run, error } = await supabase
      .from("ai_runs")
      .insert({
        user_id: userId,
        template_id: data.templateId,
        title: data.title ?? null,
        input: data.inputs,
        output,
        status: "completed",
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        cost_usd: usage.costUsd,
        metadata: kbCtx ? { citations: kbCtx.citations } : {},
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logAudit(supabase, userId, "ai.run", data.templateId, {
      run_id: run.id,
      pii: piiSummary(piiCounts),
      guard_score: guard.score,
      guard_hits: guard.hits,
      usage,
      kb_citations: kbCtx?.citations.length ?? 0,
    });

    await notifyEvent(supabase, "complete", `✅ TaskRath: รัน "${data.templateId}" เสร็จสิ้น`);

    return { id: run.id, output, pii: piiSummary(piiCounts), guard: { score: guard.score, decision: guard.decision }, usage, citations: kbCtx?.citations ?? [] };

  });

export const runFreeform = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ prompt: z.string().min(1).max(20000), redactPii: z.boolean().optional().default(true) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const guard = checkPromptInjection(data.prompt);
    if (guard.decision === "block") {
      await logAudit(supabase, userId, "ai.blocked", null, { reason: "injection", hits: guard.hits, score: guard.score });
      throw new Error("พบรูปแบบคำสั่งที่อาจเป็น prompt injection — ปฏิเสธการประมวลผล");
    }
    const r = data.redactPii ? redactPII(data.prompt) : { text: data.prompt, map: {}, counts: {} };
    const kbCtx = await retrieveKbContext(supabase, data.prompt);
    const systemPrompt = withKbContext(
      "คุณเป็นผู้ช่วย AI สำหรับเจ้าหน้าที่ราชการไทย ตอบอย่างกระชับ สุภาพ และใช้ภาษาทางการ",
      kbCtx,
    );
    const ai = await callAI(systemPrompt, r.text);
    const output = data.redactPii ? restorePII(ai.text, r.map) : ai.text;
    const { data: run, error } = await supabase
      .from("ai_runs")
      .insert({
        user_id: userId,
        template_id: null,
        input: { prompt: data.prompt },
        output,
        status: "completed",
        prompt_tokens: ai.usage.promptTokens,
        completion_tokens: ai.usage.completionTokens,
        cost_usd: ai.usage.costUsd,
        metadata: kbCtx ? { citations: kbCtx.citations } : {},
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logAudit(supabase, userId, "ai.run", null, { run_id: run.id, pii: piiSummary(r.counts), guard_score: guard.score, usage: ai.usage, kb_citations: kbCtx?.citations.length ?? 0 });
    await notifyEvent(supabase, "complete", `✅ TaskRath: รันคำสั่ง AI เสร็จสิ้น`);
    return { id: run.id, output, pii: piiSummary(r.counts), guard: { score: guard.score, decision: guard.decision }, usage: ai.usage, citations: kbCtx?.citations ?? [] };

  });

// OCR via Gemini Vision (multimodal). Accepts base64-encoded image data URL.
export const extractTextFromImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        // data URL: "data:image/png;base64,..."
        dataUrl: z.string().min(20).max(20_000_000),
        hint: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI service not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "คุณเป็นระบบ OCR สำหรับเอกสารราชการไทย จงถอดข้อความจากภาพให้ครบถ้วน คงรูปแบบย่อหน้า เลขข้อ ตาราง และหัวหนังสือ คืนเฉพาะข้อความ ไม่ต้องอธิบาย",
          },
          {
            role: "user",
            content: [
              { type: "text", text: data.hint ?? "ถอดข้อความจากภาพหนังสือราชการนี้" },
              { type: "image_url", image_url: { url: data.dataUrl } },
            ],
          },
        ],
      }),
    });
    if (res.status === 429) throw new Error("Rate limit exceeded. Please try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted.");
    if (!res.ok) throw new Error(`OCR error ${res.status}`);
    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content ?? "";
    await logAudit(supabase, userId, "ocr.extract", null, { chars: text.length });
    return { text };
  });

export const listHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("ai_runs")
      .select("id, template_id, title, status, created_at, needs_approval")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { runs: data ?? [] };
  });

export const getRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: run, error } = await supabase
      .from("ai_runs")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return { run };
  });

const REFINE_PRESETS: Record<string, string> = {
  formal: "ปรับโทนให้เป็นทางการขึ้น ใช้คำศัพท์ราชการ และโครงสร้างหนังสือทางการ",
  shorter: "ย่อให้สั้นลงประมาณครึ่งหนึ่ง คงสาระสำคัญทั้งหมด",
  longer: "ขยายความให้ละเอียดและครบถ้วนขึ้น เพิ่มรายละเอียดประกอบที่จำเป็น",
  friendly: "ปรับโทนให้เป็นมิตรและอ่านง่ายขึ้น แต่ยังคงความสุภาพแบบราชการ",
  proofread: "ตรวจแก้คำผิด ไวยากรณ์ และการเว้นวรรค คงเนื้อหาและโครงสร้างเดิม",
};

const REFINE_SYSTEM = `คุณเป็นบรรณาธิการเอกสารราชการไทย จงปรับข้อความที่ได้รับตามคำสั่งของผู้ใช้
ห้ามเพิ่มข้อมูลใหม่ที่ไม่มีในต้นฉบับ ห้ามตัดข้อมูลสำคัญ (ชื่อบุคคล วันที่ เลขที่หนังสือ จำนวนเงิน)
รักษารูปแบบหนังสือราชการ คืนเฉพาะข้อความที่ปรับแล้ว ไม่ต้องอธิบายเพิ่ม`;

type Revision = { output: string; instruction: string; preset?: string; at: string; usage: AIUsage };

export const refineRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        runId: z.string().uuid(),
        preset: z.enum(["formal", "shorter", "longer", "friendly", "proofread"]).optional(),
        instruction: z.string().min(1).max(2000).optional(),
      })
      .refine((d) => d.preset || d.instruction, { message: "preset or instruction required" })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: run, error: e0 } = await supabase
      .from("ai_runs")
      .select("id, output, metadata, prompt_tokens, completion_tokens, cost_usd")
      .eq("id", data.runId)
      .single();
    if (e0) throw new Error(e0.message);
    if (!run.output) throw new Error("Run has no output to refine");

    const instruction = data.instruction ?? REFINE_PRESETS[data.preset!];
    const guard = checkPromptInjection(instruction);
    if (guard.decision === "block") {
      await logAudit(supabase, userId, "ai.blocked", data.runId, { reason: "injection", at: "refine" });
      throw new Error("คำสั่งปรับแต่งมีรูปแบบที่ไม่อนุญาต");
    }

    const userPrompt = `คำสั่ง: ${instruction}\n\nข้อความต้นฉบับ:\n${run.output}`;
    const ai = await callAI(REFINE_SYSTEM, userPrompt);

    const meta = (run.metadata ?? {}) as { revisions?: Revision[] };
    const revisions: Revision[] = Array.isArray(meta.revisions) ? meta.revisions : [];
    revisions.push({
      output: run.output,
      instruction,
      preset: data.preset,
      at: new Date().toISOString(),
      usage: ai.usage,
    });
    const trimmed = revisions.slice(-10);

    const { error: e1 } = await supabase
      .from("ai_runs")
      .update({
        output: ai.text,
        metadata: { ...meta, revisions: trimmed },
        prompt_tokens: (run.prompt_tokens ?? 0) + ai.usage.promptTokens,
        completion_tokens: (run.completion_tokens ?? 0) + ai.usage.completionTokens,
        cost_usd: Number(run.cost_usd ?? 0) + ai.usage.costUsd,
      })
      .eq("id", data.runId);
    if (e1) throw new Error(e1.message);

    await logAudit(supabase, userId, "ai.refine", data.runId, { preset: data.preset, usage: ai.usage });
    return { output: ai.text, revisions: trimmed, usage: ai.usage };
  });

export const revertRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ runId: z.string().uuid(), index: z.number().int().min(0) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: run, error: e0 } = await supabase
      .from("ai_runs")
      .select("output, metadata")
      .eq("id", data.runId)
      .single();
    if (e0) throw new Error(e0.message);

    const meta = (run.metadata ?? {}) as { revisions?: Revision[] };
    const revisions: Revision[] = Array.isArray(meta.revisions) ? meta.revisions : [];
    if (data.index >= revisions.length) throw new Error("Invalid revision index");

    const target = revisions[data.index];
    // Push current output as a new revision so revert is undoable
    const newRevisions = [
      ...revisions,
      { output: run.output ?? "", instruction: "(สถานะก่อนกู้คืน)", at: new Date().toISOString(), usage: { promptTokens: 0, completionTokens: 0, costUsd: 0 } },
    ].slice(-10);

    const { error: e1 } = await supabase
      .from("ai_runs")
      .update({ output: target.output, metadata: { ...meta, revisions: newRevisions } })
      .eq("id", data.runId);
    if (e1) throw new Error(e1.message);

    await logAudit(supabase, userId, "ai.revert", data.runId, { index: data.index });
    return { output: target.output, revisions: newRevisions };
  });

export const requestApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ runId: z.string().uuid(), note: z.string().max(2000).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error: e1 } = await supabase
      .from("ai_runs")
      .update({ needs_approval: true })
      .eq("id", data.runId);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await supabase.from("approvals").insert({
      run_id: data.runId,
      requester_id: userId,
      status: "pending",
      note: data.note ?? null,
    });
    if (e2) throw new Error(e2.message);
    await logAudit(supabase, userId, "approval.request", data.runId, { note: data.note ?? null });
    await notifyEvent(supabase, "approval", `🔔 TaskRath: มีคำขออนุมัติใหม่ (run ${data.runId.slice(0, 8)})${data.note ? `\nหมายเหตุ: ${data.note}` : ""}`);
    return { ok: true };
  });

export const listPendingApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("approvals")
      .select("id, run_id, requester_id, status, note, created_at, decided_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { approvals: data ?? [] };
  });

export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        approvalId: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        note: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("approvals")
      .update({
        status: data.decision,
        approver_id: userId,
        note: data.note ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.approvalId);
    if (error) throw new Error(error.message);
    await logAudit(supabase, userId, `approval.${data.decision}`, data.approvalId, { note: data.note ?? null });
    return { ok: true };
  });

export const dashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [runs, pending] = await Promise.all([
      supabase.from("ai_runs").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", weekAgo),
      supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    return { runsThisWeek: runs.count ?? 0, pendingApprovals: pending.count ?? 0 };
  });

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, user_id, action, resource, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { logs: data ?? [] };
  });

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    return { isAdmin: data === true };
  });

export const adminUsageStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdminData } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (isAdminData !== true) throw new Error("Forbidden: admin role required");

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: runs, error } = await supabase
      .from("ai_runs")
      .select("user_id, template_id, prompt_tokens, completion_tokens, cost_usd, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);

    type Row = NonNullable<typeof runs>[number];
    const list: Row[] = runs ?? [];

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalCost = 0;
    const byDay = new Map<string, { tokens: number; cost: number; runs: number }>();
    const byUser = new Map<string, { runs: number; tokens: number; cost: number }>();
    const byTemplate = new Map<string, { runs: number; tokens: number; cost: number }>();

    for (const r of list) {
      const pt = r.prompt_tokens ?? 0;
      const ct = r.completion_tokens ?? 0;
      const cost = Number(r.cost_usd ?? 0);
      const tokens = pt + ct;
      totalPromptTokens += pt;
      totalCompletionTokens += ct;
      totalCost += cost;
      const day = r.created_at.slice(0, 10);
      const d = byDay.get(day) ?? { tokens: 0, cost: 0, runs: 0 };
      d.tokens += tokens; d.cost += cost; d.runs += 1;
      byDay.set(day, d);
      const u = byUser.get(r.user_id) ?? { runs: 0, tokens: 0, cost: 0 };
      u.runs += 1; u.tokens += tokens; u.cost += cost;
      byUser.set(r.user_id, u);
      const tid = r.template_id ?? "(freeform)";
      const t = byTemplate.get(tid) ?? { runs: 0, tokens: 0, cost: 0 };
      t.runs += 1; t.tokens += tokens; t.cost += cost;
      byTemplate.set(tid, t);
    }

    const userIds = [...byUser.keys()];
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
      : { data: [] as { id: string; display_name: string | null }[] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name ?? p.id.slice(0, 8)]));

    return {
      totals: {
        runs: list.length,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        costUsd: totalCost,
      },
      daily: [...byDay.entries()]
        .map(([day, v]) => ({ day, ...v }))
        .sort((a, b) => a.day.localeCompare(b.day)),
      topUsers: [...byUser.entries()]
        .map(([id, v]) => ({ id, name: nameMap.get(id) ?? id.slice(0, 8), ...v }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10),
      topTemplates: [...byTemplate.entries()]
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.runs - a.runs)
        .slice(0, 10),
    };
  });

// ─────────────────────────────────────────────────────────────
// Agents — specialised AI personas. Each has its own system prompt.
// Output is persisted to ai_runs with template_id = `agent:<id>`.
// ─────────────────────────────────────────────────────────────
export type AgentDef = {
  id: string;
  titleTh: string;
  titleEn: string;
  descTh: string;
  descEn: string;
  systemPrompt: string;
  skills: string[];
  placeholderTh: string;
};

export const AGENTS: AgentDef[] = [
  {
    id: "doc-assistant",
    titleTh: "ผู้ช่วยเอกสาร",
    titleEn: "Document Assistant",
    descTh: "ช่วยร่าง สรุป แปล และตรวจเอกสารราชการ",
    descEn: "Draft, summarize, translate, and proofread official documents",
    systemPrompt:
      "คุณคือผู้ช่วยเอกสารราชการไทยมากประสบการณ์ ตอบเป็นภาษาทางการ ใช้รูปแบบหนังสือราชการเมื่อเหมาะสม สรุปสาระให้กระชับ ชัดเจน และจัดโครงสร้างเป็นหัวข้อเมื่อช่วยให้อ่านง่าย",
    skills: ["สรุป", "ร่าง", "แปล", "ตรวจคำผิด"],
    placeholderTh: "เช่น สรุปเอกสารต่อไปนี้ให้เป็น bullet 5 ข้อ…",
  },
  {
    id: "budget-analyst",
    titleTh: "นักวิเคราะห์งบประมาณ",
    titleEn: "Budget Analyst",
    descTh: "วิเคราะห์งบประมาณ คำนวณ และเสนอแนะเชิงนโยบาย",
    descEn: "Analyze budgets and provide policy recommendations",
    systemPrompt:
      "คุณคือนักวิเคราะห์งบประมาณภาครัฐ จงประเมินตัวเลขในมุมความสมเหตุสมผล ประสิทธิภาพ ความเสี่ยง ความสอดคล้องกับยุทธศาสตร์ และให้ข้อเสนอแนะเชิงนโยบายอย่างเป็นกลาง ใช้ภาษาทางการ",
    skills: ["วิเคราะห์", "พยากรณ์", "เสนอแนะ"],
    placeholderTh: "เช่น วิเคราะห์งบประมาณโครงการต่อไปนี้ มูลค่า 12 ล้านบาท…",
  },
  {
    id: "citizen-service",
    titleTh: "เจ้าหน้าที่บริการประชาชน",
    titleEn: "Citizen Service",
    descTh: "ร่างคำตอบเรื่องร้องเรียน ตอบคำถาม FAQ ด้วยภาษาสุภาพ",
    descEn: "Draft replies to citizen requests and complaints",
    systemPrompt:
      "คุณคือเจ้าหน้าที่บริการประชาชนผู้สุภาพและเป็นมิตร จงร่างคำตอบที่ชัดเจน สุภาพ ระบุแนวทางดำเนินการที่ประชาชนสามารถทำได้จริง หลีกเลี่ยงศัพท์ราชการที่เข้าใจยาก",
    skills: ["ตอบ", "จำแนกประเภท", "ส่งต่อ"],
    placeholderTh: "เช่น ประชาชนร้องเรียนเรื่องไฟถนนดับมา 2 สัปดาห์ ขอให้ร่างคำตอบ…",
  },
  {
    id: "legal-researcher",
    titleTh: "นักวิจัยกฎหมาย",
    titleEn: "Legal Researcher",
    descTh: "ค้น สรุป และอธิบายกฎหมาย/ระเบียบ",
    descEn: "Research, summarize, and explain laws and regulations",
    systemPrompt:
      "คุณคือนักวิจัยด้านกฎหมายและระเบียบราชการไทย จงอธิบายและสรุปสาระของกฎหมายให้เข้าใจง่าย ระบุผู้บังคับใช้ ผู้ได้รับผลกระทบ และข้อควรระวัง อ้างอิงชื่อกฎหมายและมาตราเมื่อมีในต้นฉบับ ห้ามแต่งข้อกฎหมายขึ้นมาเอง",
    skills: ["ค้นหา", "สรุป", "อธิบาย"],
    placeholderTh: "เช่น สรุปสาระสำคัญของ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล…",
  },
];

export const AGENTS_BY_ID: Record<string, AgentDef> = Object.fromEntries(
  AGENTS.map((a) => [a.id, a]),
);

export const runAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        agentId: z.string().min(1).max(64),
        prompt: z.string().min(1).max(20000),
        redactPii: z.boolean().optional().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const agent = AGENTS_BY_ID[data.agentId];
    if (!agent) throw new Error("Unknown agent");

    const guard = checkPromptInjection(data.prompt);
    if (guard.decision === "block") {
      await logAudit(supabase, userId, "ai.blocked", `agent:${data.agentId}`, {
        reason: "injection",
        hits: guard.hits,
        score: guard.score,
      });
      throw new Error("พบรูปแบบคำสั่งที่อาจเป็น prompt injection — ปฏิเสธการประมวลผล");
    }

    const r = data.redactPii ? redactPII(data.prompt) : { text: data.prompt, map: {}, counts: {} };
    const kbCtx = await retrieveKbContext(supabase, data.prompt);
    const ai = await callAI(withKbContext(agent.systemPrompt, kbCtx), r.text);
    const output = data.redactPii ? restorePII(ai.text, r.map) : ai.text;

    const { data: run, error } = await supabase
      .from("ai_runs")
      .insert({
        user_id: userId,
        template_id: `agent:${data.agentId}`,
        title: `${agent.titleTh}`,
        input: { prompt: data.prompt },
        output,
        status: "completed",
        prompt_tokens: ai.usage.promptTokens,
        completion_tokens: ai.usage.completionTokens,
        cost_usd: ai.usage.costUsd,
        metadata: kbCtx ? { citations: kbCtx.citations } : {},
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logAudit(supabase, userId, "ai.agent", `agent:${data.agentId}`, {
      run_id: run.id,
      pii: piiSummary(r.counts),
      guard_score: guard.score,
      usage: ai.usage,
      kb_citations: kbCtx?.citations.length ?? 0,
    });
    await notifyEvent(supabase, "complete", `🤖 TaskRath Agent "${agent.titleTh}" ตอบเสร็จแล้ว`);

    return { id: run.id, output, usage: ai.usage, pii: piiSummary(r.counts), citations: kbCtx?.citations ?? [] };

  });
