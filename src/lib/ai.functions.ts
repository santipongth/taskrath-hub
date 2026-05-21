import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI service not configured");

  // HiClaw integration: when HICLAW_API_URL is set, route there instead.
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
    return json.choices?.[0]?.message?.content ?? "";
  }

  // Fallback: Lovable AI Gateway (Gemini)
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
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
  return json.choices?.[0]?.message?.content ?? "";
}

export const runTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        templateId: z.string().min(1).max(64),
        inputs: z.record(z.string(), z.string().max(20000)),
        title: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const systemPrompt = TEMPLATE_PROMPTS[data.templateId] ?? "คุณเป็นผู้ช่วยที่เชี่ยวชาญงานราชการไทย";
    const userPrompt = Object.entries(data.inputs)
      .map(([k, v]) => `${k}:\n${v}`)
      .join("\n\n");

    const output = await callAI(systemPrompt, userPrompt);

    const { data: run, error } = await supabase
      .from("ai_runs")
      .insert({
        user_id: userId,
        template_id: data.templateId,
        title: data.title ?? null,
        input: data.inputs,
        output,
        status: "completed",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { id: run.id, output };
  });

export const runFreeform = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ prompt: z.string().min(1).max(20000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const output = await callAI(
      "คุณเป็นผู้ช่วย AI สำหรับเจ้าหน้าที่ราชการไทย ตอบอย่างกระชับ สุภาพ และใช้ภาษาทางการ",
      data.prompt,
    );
    const { data: run, error } = await supabase
      .from("ai_runs")
      .insert({
        user_id: userId,
        template_id: null,
        input: { prompt: data.prompt },
        output,
        status: "completed",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: run.id, output };
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
