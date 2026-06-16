import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { redactPII, restorePII, piiSummary } from "@/lib/pii";
import { checkPromptInjection } from "@/lib/prompt-guard";
import { retrieveKbContext } from "@/lib/kb.functions";
import { callAI, withKbContext, notifyEvent } from "@/lib/ai.functions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export type DeptSkill = {
  id: string;
  department: string;
  name: string;
  description: string | null;
  system_prompt: string;
  fields: Array<{ key: string; label: string; type?: string; required?: boolean }>;
  kb_category: string | null;
  model: string | null;
  needs_approval: boolean;
  status: "active" | "draft";
  created_at: string;
  updated_at: string;
};

export type DeptAgent = {
  id: string;
  department: string;
  name: string;
  description: string | null;
  role_prompt: string;
  default_model: string | null;
  status: "active" | "draft";
  created_at: string;
  updated_at: string;
  skills?: DeptSkill[];
};

async function getMyDepartment(supabase: SB, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("department")
    .eq("id", userId)
    .maybeSingle();
  return (data?.department as string | null) ?? null;
}

async function assertDeptAdmin(supabase: SB, userId: string, dept: string) {
  // global admin
  const { data: adminRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "dept_admin"]);
  const roles = (adminRow ?? []).map((r: { role: string }) => r.role);
  if (roles.includes("admin")) return;
  if (!roles.includes("dept_admin")) throw new Error("ต้องเป็น dept_admin ของหน่วยงาน");
  const myDept = await getMyDepartment(supabase, userId);
  if (myDept !== dept) throw new Error("คุณไม่ใช่ admin ของหน่วยงานนี้");
}

// ── Skills ──────────────────────────────────────────────────
export const listDeptSkills = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: SB; userId: string };
    const dept = await getMyDepartment(supabase, userId);
    if (!dept) return { department: null, skills: [] as DeptSkill[] };
    const { data, error } = await supabase
      .from("dept_skills")
      .select("*")
      .eq("department", dept)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { department: dept, skills: (data ?? []) as DeptSkill[] };
  });

const skillInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  system_prompt: z.string().max(8000).default(""),
  fields: z
    .array(
      z.object({
        key: z.string().min(1).max(60),
        label: z.string().min(1).max(120),
        type: z.string().max(20).optional(),
        required: z.boolean().optional(),
      }),
    )
    .max(20)
    .default([]),
  kb_category: z.string().max(80).optional().nullable(),
  model: z.string().max(80).optional().nullable(),
  needs_approval: z.boolean().default(false),
  status: z.enum(["active", "draft"]).default("active"),
});

export const upsertDeptSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => skillInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: SB; userId: string };
    const dept = await getMyDepartment(supabase, userId);
    if (!dept) throw new Error("ผู้ใช้ยังไม่ถูกกำหนดหน่วยงาน");
    await assertDeptAdmin(supabase, userId, dept);
    const payload = {
      department: dept,
      name: data.name,
      description: data.description ?? null,
      system_prompt: data.system_prompt,
      fields: data.fields,
      kb_category: data.kb_category ?? null,
      model: data.model ?? null,
      needs_approval: data.needs_approval,
      status: data.status,
      created_by: userId,
    };
    if (data.id) {
      const { data: row, error } = await supabase
        .from("dept_skills")
        .update(payload)
        .eq("id", data.id)
        .eq("department", dept)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return row as DeptSkill;
    }
    const { data: row, error } = await supabase
      .from("dept_skills")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as DeptSkill;
  });

export const deleteDeptSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: SB; userId: string };
    const dept = await getMyDepartment(supabase, userId);
    if (!dept) throw new Error("ผู้ใช้ยังไม่ถูกกำหนดหน่วยงาน");
    await assertDeptAdmin(supabase, userId, dept);
    const { error } = await supabase
      .from("dept_skills")
      .delete()
      .eq("id", data.id)
      .eq("department", dept);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Agents ──────────────────────────────────────────────────
export const listDeptAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: SB; userId: string };
    const dept = await getMyDepartment(supabase, userId);
    if (!dept) return { department: null, agents: [] as DeptAgent[] };
    const { data: agents, error } = await supabase
      .from("dept_agents")
      .select("*")
      .eq("department", dept)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (agents ?? []).map((a: DeptAgent) => a.id);
    if (ids.length === 0) return { department: dept, agents: [] as DeptAgent[] };
    const { data: links } = await supabase
      .from("dept_agent_skills")
      .select("agent_id, skill_id, order_index, dept_skills(*)")
      .in("agent_id", ids);
    const byAgent = new Map<string, DeptSkill[]>();
    for (const l of links ?? []) {
      const list = byAgent.get(l.agent_id) ?? [];
      if (l.dept_skills) list.push(l.dept_skills as DeptSkill);
      byAgent.set(l.agent_id, list);
    }
    return {
      department: dept,
      agents: (agents ?? []).map((a: DeptAgent) => ({ ...a, skills: byAgent.get(a.id) ?? [] })),
    };
  });

const agentInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  role_prompt: z.string().max(8000).default(""),
  default_model: z.string().max(80).optional().nullable(),
  status: z.enum(["active", "draft"]).default("active"),
  skill_ids: z.array(z.string().uuid()).max(20).default([]),
});

export const upsertDeptAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => agentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: SB; userId: string };
    const dept = await getMyDepartment(supabase, userId);
    if (!dept) throw new Error("ผู้ใช้ยังไม่ถูกกำหนดหน่วยงาน");
    await assertDeptAdmin(supabase, userId, dept);

    const payload = {
      department: dept,
      name: data.name,
      description: data.description ?? null,
      role_prompt: data.role_prompt,
      default_model: data.default_model ?? null,
      status: data.status,
      created_by: userId,
    };

    let agentId: string;
    if (data.id) {
      const { data: row, error } = await supabase
        .from("dept_agents")
        .update(payload)
        .eq("id", data.id)
        .eq("department", dept)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      agentId = row.id;
    } else {
      const { data: row, error } = await supabase
        .from("dept_agents")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      agentId = row.id;
    }

    // Sync skills (delete + reinsert)
    await supabase.from("dept_agent_skills").delete().eq("agent_id", agentId);
    if (data.skill_ids.length > 0) {
      const rows = data.skill_ids.map((sid, i) => ({
        agent_id: agentId,
        skill_id: sid,
        order_index: i,
      }));
      const { error: linkErr } = await supabase.from("dept_agent_skills").insert(rows);
      if (linkErr) throw new Error(linkErr.message);
    }
    return { id: agentId };
  });

export const deleteDeptAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: SB; userId: string };
    const dept = await getMyDepartment(supabase, userId);
    if (!dept) throw new Error("ผู้ใช้ยังไม่ถูกกำหนดหน่วยงาน");
    await assertDeptAdmin(supabase, userId, dept);
    const { error } = await supabase
      .from("dept_agents")
      .delete()
      .eq("id", data.id)
      .eq("department", dept);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Run ─────────────────────────────────────────────────────
export const runDeptAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        agentId: z.string().uuid(),
        skillId: z.string().uuid().optional(),
        prompt: z.string().min(1).max(20000),
        fields: z.record(z.string(), z.string().max(20000)).optional(),
        redactPii: z.boolean().optional().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: SB; userId: string };

    // Load agent (RLS enforces membership)
    const { data: agent, error: aErr } = await supabase
      .from("dept_agents")
      .select("*")
      .eq("id", data.agentId)
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!agent) throw new Error("ไม่พบ agent หรือไม่มีสิทธิ์เข้าถึง");

    // Load skill (optional)
    let skill: DeptSkill | null = null;
    if (data.skillId) {
      const { data: linked } = await supabase
        .from("dept_agent_skills")
        .select("skill_id, dept_skills(*)")
        .eq("agent_id", data.agentId)
        .eq("skill_id", data.skillId)
        .maybeSingle();
      skill = (linked?.dept_skills as DeptSkill | null) ?? null;
      if (!skill) throw new Error("Skill นี้ไม่ได้ถูกมอบหมายให้ agent");
    }

    // Build full prompt
    const fieldsBlock = data.fields
      ? Object.entries(data.fields)
          .map(([k, v]) => `${k}:\n${v}`)
          .join("\n\n")
      : "";
    const rawUserPrompt = [fieldsBlock, data.prompt].filter(Boolean).join("\n\n");

    const guard = checkPromptInjection(rawUserPrompt);
    if (guard.decision === "block") {
      await supabase.rpc("log_audit", {
        p_action: "ai.blocked",
        p_resource: `dept_agent:${agent.id}`,
        p_metadata: { reason: "injection", hits: guard.hits, score: guard.score },
      });
      throw new Error("พบรูปแบบคำสั่งที่อาจเป็น prompt injection — ปฏิเสธการประมวลผล");
    }

    const r = data.redactPii
      ? redactPII(rawUserPrompt)
      : { text: rawUserPrompt, map: {}, counts: {} };

    const baseSystem = [agent.role_prompt, skill?.system_prompt]
      .filter((s) => s && s.trim().length > 0)
      .join("\n\n");
    const systemPrompt =
      baseSystem ||
      "คุณคือผู้ช่วย AI ของหน่วยงานราชการไทย ตอบเป็นภาษาทางการ กระชับ ชัดเจน";

    const kbCtx = await retrieveKbContext(supabase, rawUserPrompt);
    const ai = await callAI(withKbContext(systemPrompt, kbCtx), r.text);
    const output = data.redactPii ? restorePII(ai.text, r.map) : ai.text;

    const needsApproval = !!skill?.needs_approval;

    const { data: run, error: rErr } = await supabase
      .from("ai_runs")
      .insert({
        user_id: userId,
        template_id: `dept_agent:${agent.id}`,
        title: skill ? `${agent.name} · ${skill.name}` : agent.name,
        input: { prompt: data.prompt, fields: data.fields ?? {} },
        output,
        status: "completed",
        needs_approval: needsApproval,
        prompt_tokens: ai.usage.promptTokens,
        completion_tokens: ai.usage.completionTokens,
        cost_usd: ai.usage.costUsd,
        metadata: kbCtx ? { citations: kbCtx.citations } : {},
        department: agent.department,
        dept_agent_id: agent.id,
        dept_skill_id: skill?.id ?? null,
      })
      .select("id")
      .single();
    if (rErr) throw new Error(rErr.message);

    if (needsApproval) {
      await supabase.from("approvals").insert({
        run_id: run.id,
        requester_id: userId,
        status: "pending",
      });
      await notifyEvent(
        supabase,
        "approval",
        `📝 ขออนุมัติงานจาก agent "${agent.name}" (หน่วยงาน ${agent.department})`,
      );
    } else {
      await notifyEvent(supabase, "complete", `🤖 ${agent.name} ตอบเสร็จแล้ว`);
    }

    await supabase.rpc("log_audit", {
      p_action: "ai.dept_agent",
      p_resource: `dept_agent:${agent.id}`,
      p_metadata: {
        run_id: run.id,
        agent: agent.name,
        skill: skill?.name ?? null,
        department: agent.department,
        pii: piiSummary(r.counts),
        usage: ai.usage,
        kb_citations: kbCtx?.citations.length ?? 0,
      },
    });

    return {
      id: run.id,
      output,
      usage: ai.usage,
      pii: piiSummary(r.counts),
      citations: kbCtx?.citations ?? [],
      needsApproval,
    };
  });

// Check whether current user can manage dept agents/skills
export const getDeptAdminInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: SB; userId: string };
    const dept = await getMyDepartment(supabase, userId);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const list = (roles ?? []).map((r: { role: string }) => r.role);
    const isAdmin = list.includes("admin");
    const isDeptAdmin = list.includes("dept_admin");
    return {
      department: dept,
      isAdmin,
      isDeptAdmin,
      canManage: isAdmin || (isDeptAdmin && !!dept),
    };
  });

// ── Department-wide run history & stats ───────────────────
export type DeptRunRow = {
  id: string;
  created_at: string;
  user_id: string;
  title: string | null;
  status: string;
  needs_approval: boolean;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cost_usd: number | null;
  dept_agent_id: string | null;
  dept_skill_id: string | null;
};

export const listDeptRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        days: z.number().int().min(1).max(180).default(30),
        agentId: z.string().uuid().optional(),
        skillId: z.string().uuid().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: SB; userId: string };
    const dept = await getMyDepartment(supabase, userId);
    if (!dept) {
      return { department: null, runs: [], stats: null, byAgent: [], bySkill: [], agents: [], skills: [] };
    }
    await assertDeptAdmin(supabase, userId, dept);

    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    let q = supabase
      .from("ai_runs")
      .select(
        "id,created_at,user_id,title,status,needs_approval,prompt_tokens,completion_tokens,cost_usd,dept_agent_id,dept_skill_id",
      )
      .eq("department", dept)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.agentId) q = q.eq("dept_agent_id", data.agentId);
    if (data.skillId) q = q.eq("dept_skill_id", data.skillId);
    const { data: runs, error } = await q;
    if (error) throw new Error(error.message);

    const [{ data: agents }, { data: skills }] = await Promise.all([
      supabase.from("dept_agents").select("id,name").eq("department", dept),
      supabase.from("dept_skills").select("id,name").eq("department", dept),
    ]);
    const agentMap = new Map<string, string>((agents ?? []).map((a: { id: string; name: string }) => [a.id, a.name] as [string, string]));
    const skillMap = new Map<string, string>((skills ?? []).map((s: { id: string; name: string }) => [s.id, s.name] as [string, string]));


    const list = (runs ?? []) as DeptRunRow[];
    const total = list.length;
    const ok = list.filter((r) => r.status === "completed").length;
    const failed = list.filter((r) => r.status === "failed" || r.status === "error").length;
    const pending = list.filter((r) => r.needs_approval).length;
    const totalCost = list.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
    const totalTokens = list.reduce(
      (s, r) => s + Number(r.prompt_tokens ?? 0) + Number(r.completion_tokens ?? 0),
      0,
    );

    type Bucket = { id: string; name: string; total: number; ok: number; failed: number; cost: number };
    const byAgent: Record<string, Bucket> = {};
    const bySkill: Record<string, Bucket> = {};
    for (const r of list) {
      if (r.dept_agent_id) {
        const k = r.dept_agent_id;
        byAgent[k] ??= { id: k, name: agentMap.get(k) ?? "(ลบแล้ว)", total: 0, ok: 0, failed: 0, cost: 0 };
        byAgent[k].total++;
        if (r.status === "completed") byAgent[k].ok++;
        if (r.status === "failed" || r.status === "error") byAgent[k].failed++;
        byAgent[k].cost += Number(r.cost_usd ?? 0);
      }
      if (r.dept_skill_id) {
        const k = r.dept_skill_id;
        bySkill[k] ??= { id: k, name: skillMap.get(k) ?? "(ลบแล้ว)", total: 0, ok: 0, failed: 0, cost: 0 };
        bySkill[k].total++;
        if (r.status === "completed") bySkill[k].ok++;
        if (r.status === "failed" || r.status === "error") bySkill[k].failed++;
        bySkill[k].cost += Number(r.cost_usd ?? 0);
      }
    }

    return {
      department: dept,
      runs: list.map((r) => ({
        ...r,
        agent_name: r.dept_agent_id ? agentMap.get(r.dept_agent_id) ?? null : null,
        skill_name: r.dept_skill_id ? skillMap.get(r.dept_skill_id) ?? null : null,
      })),
      stats: { total, ok, failed, pending, totalCost, totalTokens },
      byAgent: Object.values(byAgent).sort((a, b) => b.total - a.total),
      bySkill: Object.values(bySkill).sort((a, b) => b.total - a.total),
      agents: (agents ?? []) as Array<{ id: string; name: string }>,
      skills: (skills ?? []) as Array<{ id: string; name: string }>,
    };
  });

