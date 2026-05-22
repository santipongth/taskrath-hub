import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { redactPII, restorePII, piiSummary } from "@/lib/pii";
import { checkPromptInjection } from "@/lib/prompt-guard";

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
    try {
      const r = await callAI(systemPrompt, userPromptForAI);
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
    });

    return { id: run.id, output, pii: piiSummary(piiCounts), guard: { score: guard.score, decision: guard.decision }, usage };
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
    const ai = await callAI(
      "คุณเป็นผู้ช่วย AI สำหรับเจ้าหน้าที่ราชการไทย ตอบอย่างกระชับ สุภาพ และใช้ภาษาทางการ",
      r.text,
    );
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
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logAudit(supabase, userId, "ai.run", null, { run_id: run.id, pii: piiSummary(r.counts), guard_score: guard.score, usage: ai.usage });
    return { id: run.id, output, pii: piiSummary(r.counts), guard: { score: guard.score, decision: guard.decision }, usage: ai.usage };
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
