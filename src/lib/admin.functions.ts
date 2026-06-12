import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data !== true) throw new Error("Forbidden: admin role required");
}

export const executiveStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ days: z.number().int().min(1).max(365).default(30) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: runs, error: runsErr }, { data: profiles }] = await Promise.all([
      supabase
        .from("ai_runs")
        .select("user_id, template_id, status, needs_approval, cost_usd, prompt_tokens, completion_tokens, created_at")
        .gte("created_at", since)
        .limit(10000),
      supabase.from("profiles").select("id, display_name, department"),
    ]);
    if (runsErr) throw new Error(runsErr.message);

    type Row = NonNullable<typeof runs>[number];
    const list: Row[] = runs ?? [];
    const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const byDept = new Map<string, { runs: number; cost: number }>();
    const byTemplate = new Map<string, { runs: number; cost: number }>();
    const byDay = new Map<string, { runs: number; cost: number }>();
    const activeUsers = new Set<string>();
    let totalCost = 0;
    let totalTokens = 0;

    for (const r of list) {
      const cost = Number(r.cost_usd ?? 0);
      const tokens = (r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0);
      totalCost += cost;
      totalTokens += tokens;
      activeUsers.add(r.user_id);

      const dept = profMap.get(r.user_id)?.department ?? "ไม่ระบุ";
      const d = byDept.get(dept) ?? { runs: 0, cost: 0 };
      d.runs += 1; d.cost += cost;
      byDept.set(dept, d);

      const tid = r.template_id ?? "(freeform)";
      const t = byTemplate.get(tid) ?? { runs: 0, cost: 0 };
      t.runs += 1; t.cost += cost;
      byTemplate.set(tid, t);

      const day = r.created_at.slice(0, 10);
      const dd = byDay.get(day) ?? { runs: 0, cost: 0 };
      dd.runs += 1; dd.cost += cost;
      byDay.set(day, dd);
    }

    return {
      totals: {
        runs: list.length,
        costUsd: totalCost,
        tokens: totalTokens,
        activeUsers: activeUsers.size,
        avgCost: list.length ? totalCost / list.length : 0,
      },
      byDepartment: [...byDept.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.runs - a.runs),
      byTemplate: [...byTemplate.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.runs - a.runs).slice(0, 10),
      daily: [...byDay.entries()].map(([day, v]) => ({ day, ...v })).sort((a, b) => a.day.localeCompare(b.day)),
    };
  });

export type AgencySettings = {
  name: string;
  subUnit: string;
  address: string;
  phone: string;
  email: string;
  signerName: string;
  signerPosition: string;
  letterheadPath: string;
};

const DEFAULT_AGENCY: AgencySettings = {
  name: "ส่วนราชการ",
  subUnit: "",
  address: "",
  phone: "",
  email: "",
  signerName: "",
  signerPosition: "",
  letterheadPath: "",
};

export const getAgencySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AgencySettings> => {
    const { supabase } = context;
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "agency")
      .maybeSingle();
    return { ...DEFAULT_AGENCY, ...((data?.value as Partial<AgencySettings>) ?? {}) };
  });

export const updateAgencySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().min(1).max(200),
        subUnit: z.string().max(200).default(""),
        address: z.string().max(500).default(""),
        phone: z.string().max(50).default(""),
        email: z.string().max(120).default(""),
        signerName: z.string().max(120).default(""),
        signerPosition: z.string().max(120).default(""),
        letterheadPath: z.string().max(300).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "agency", value: data, updated_by: userId }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
