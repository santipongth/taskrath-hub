import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProviderRow, RouteChain } from "@/lib/providers.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export type DeptProvider = ProviderRow & {
  created_at: string;
  updated_at: string;
};

export type DeptRoute = {
  id: string;
  department: string;
  name: string;
  is_default: boolean;
  chain: RouteChain;
  created_at: string;
  updated_at: string;
};

async function getMyDepartment(supabase: SB, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("department")
    .eq("id", userId)
    .maybeSingle();
  return (data?.department as string | null) ?? null;
}

async function assertDeptAdmin(supabase: SB, userId: string): Promise<string> {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const list = (roles ?? []).map((r: { role: string }) => r.role);
  if (list.includes("admin")) {
    const dept = await getMyDepartment(supabase, userId);
    if (!dept) throw new Error("ไม่ได้กำหนดหน่วยงานในโปรไฟล์");
    return dept;
  }
  if (!list.includes("dept_admin")) throw new Error("ต้องเป็น dept_admin");
  const dept = await getMyDepartment(supabase, userId);
  if (!dept) throw new Error("ไม่ได้กำหนดหน่วยงานในโปรไฟล์");
  return dept;
}

const ProviderKind = z.enum(["lovable", "openai_compatible", "typhoon", "hiclaw"]);
const SecretNameRegex = /^[A-Z_][A-Z0-9_]*$/;

const ProviderInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  kind: ProviderKind,
  base_url: z
    .string()
    .max(300)
    .optional()
    .nullable()
    .refine(
      (v) => !v || /^https:\/\//i.test(v) || /^http:\/\/localhost(:\d+)?(\/|$)/i.test(v),
      "base_url ต้องเป็น https:// (อนุญาต http://localhost)",
    ),
  model_id: z.string().min(1).max(120),
  api_key_secret_name: z
    .string()
    .max(120)
    .optional()
    .nullable()
    .refine((v) => !v || SecretNameRegex.test(v), "ชื่อ secret รองรับเฉพาะ A-Z, 0-9, _"),
  price_in_per_mtok: z.number().min(0).max(1000).default(0),
  price_out_per_mtok: z.number().min(0).max(1000).default(0),
  enabled: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(9999).default(0),
});

export const listDeptProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: SB; userId: string };
    const dept = await getMyDepartment(supabase, userId);
    if (!dept) return { providers: [] as DeptProvider[], department: null };
    const { data, error } = await supabase
      .from("dept_model_providers")
      .select("*")
      .eq("department", dept)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { providers: (data ?? []) as DeptProvider[], department: dept };
  });

export const upsertDeptProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProviderInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: SB; userId: string };
    const dept = await assertDeptAdmin(supabase, userId);
    const row = {
      department: dept,
      name: data.name,
      kind: data.kind,
      base_url: data.base_url ?? null,
      model_id: data.model_id,
      api_key_secret_name: data.api_key_secret_name ?? null,
      price_in_per_mtok: data.price_in_per_mtok,
      price_out_per_mtok: data.price_out_per_mtok,
      enabled: data.enabled,
      sort_order: data.sort_order,
      created_by: userId,
    };
    if (data.id) {
      const { error } = await supabase
        .from("dept_model_providers")
        .update(row)
        .eq("id", data.id)
        .eq("department", dept);
      if (error) throw new Error(error.message);
      return { id: data.id };
    } else {
      const { data: ins, error } = await supabase
        .from("dept_model_providers")
        .insert(row)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: ins.id as string };
    }
  });

export const deleteDeptProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: SB; userId: string };
    const dept = await assertDeptAdmin(supabase, userId);
    const { error } = await supabase
      .from("dept_model_providers")
      .delete()
      .eq("id", data.id)
      .eq("department", dept);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testDeptProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: SB; userId: string };
    const dept = await assertDeptAdmin(supabase, userId);
    const { data: p, error } = await supabase
      .from("dept_model_providers")
      .select("*")
      .eq("id", data.id)
      .eq("department", dept)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) throw new Error("ไม่พบ provider");
    const { callProvider } = await import("@/lib/providers.server");
    const t0 = Date.now();
    try {
      const r = await callProvider(
        p as ProviderRow,
        "You are a connectivity check. Reply with the single word: pong.",
        "ping",
      );
      return {
        ok: true,
        latency_ms: Date.now() - t0,
        sample: (r.text ?? "").slice(0, 200),
        usage: { promptTokens: r.promptTokens, completionTokens: r.completionTokens, costUsd: r.costUsd },
      };
    } catch (e) {
      return {
        ok: false,
        latency_ms: Date.now() - t0,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });

const RouteInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  is_default: z.boolean().default(false),
  chain: z
    .array(
      z.object({
        provider_id: z.string().uuid(),
        on_error: z.array(z.enum(["429", "5xx", "4xx", "timeout", "any"])).optional(),
      }),
    )
    .min(1)
    .max(8),
});

export const listDeptRoutes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: SB; userId: string };
    const dept = await getMyDepartment(supabase, userId);
    if (!dept) return { routes: [] as DeptRoute[], department: null };
    const { data, error } = await supabase
      .from("dept_model_routes")
      .select("*")
      .eq("department", dept)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { routes: (data ?? []) as DeptRoute[], department: dept };
  });

export const upsertDeptRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RouteInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: SB; userId: string };
    const dept = await assertDeptAdmin(supabase, userId);
    if (data.is_default) {
      await supabase
        .from("dept_model_routes")
        .update({ is_default: false })
        .eq("department", dept);
    }
    const row = {
      department: dept,
      name: data.name,
      is_default: data.is_default,
      chain: data.chain,
      created_by: userId,
    };
    if (data.id) {
      const { error } = await supabase
        .from("dept_model_routes")
        .update(row)
        .eq("id", data.id)
        .eq("department", dept);
      if (error) throw new Error(error.message);
      return { id: data.id };
    } else {
      const { data: ins, error } = await supabase
        .from("dept_model_routes")
        .insert(row)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: ins.id as string };
    }
  });

export const deleteDeptRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: SB; userId: string };
    const dept = await assertDeptAdmin(supabase, userId);
    const { error } = await supabase
      .from("dept_model_routes")
      .delete()
      .eq("id", data.id)
      .eq("department", dept);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
