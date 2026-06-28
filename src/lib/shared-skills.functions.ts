import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SharedSkill = {
  id: string;
  department: string;
  name: string;
  icon: string | null;
  category: string | null;
  description: string | null;
  example_output: string | null;
  role_prompt: string;
  default_model_selector: string | null;
  sort_order: number;
  is_active: boolean;
  created_by: string | null;
  updated_at: string;
};

export type CombinedSkill = {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  source: "shared" | "personal";
  department?: string | null;
};

const MAX_NAME = 80;
const MAX_PROMPT = 6000;

async function getMyDept(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("department")
    .eq("id", userId)
    .maybeSingle();
  return (data?.department as string | null) ?? null;
}

async function isDeptAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  dept: string,
): Promise<boolean> {
  const { data } = await supabase.rpc("is_dept_admin", { _user_id: userId, _dept: dept });
  return Boolean(data);
}

/** Skills visible to the current user (their department, active only). */
export const listSharedSkills = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const dept = await getMyDept(supabase, userId);
    if (!dept) return { skills: [] as SharedSkill[], department: null, canManage: false };
    const { data, error } = await supabase
      .from("shared_skills")
      .select(
        "id, department, name, icon, category, description, example_output, role_prompt, default_model_selector, sort_order, is_active, created_by, updated_at",
      )
      .eq("department", dept)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    const canManage = await isDeptAdmin(supabase, userId, dept);
    return { skills: (data ?? []) as SharedSkill[], department: dept, canManage };
  });

/** All skills (including inactive) for the admin manage page. */
export const listSharedSkillsForAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const dept = await getMyDept(supabase, userId);
    if (!dept) {
      return {
        skills: [] as SharedSkill[],
        department: null as string | null,
        error: "no_department" as const,
      };
    }
    const can = await isDeptAdmin(supabase, userId, dept);
    if (!can) {
      return {
        skills: [] as SharedSkill[],
        department: dept,
        error: "not_admin" as const,
      };
    }
    const { data, error } = await supabase
      .from("shared_skills")
      .select(
        "id, department, name, icon, category, description, example_output, role_prompt, default_model_selector, sort_order, is_active, created_by, updated_at",
      )
      .eq("department", dept)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return {
      skills: (data ?? []) as SharedSkill[],
      department: dept,
      error: null as null | "no_department" | "not_admin",
    };
  });


export const upsertSharedSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(MAX_NAME),
        icon: z.string().trim().max(40).optional().nullable(),
        category: z.string().trim().max(60).optional().nullable(),
        description: z.string().trim().max(500).optional().nullable(),
        example_output: z.string().trim().max(4000).optional().nullable(),
        role_prompt: z.string().trim().min(1).max(MAX_PROMPT),
        default_model_selector: z.string().trim().max(120).optional().nullable(),
        sort_order: z.number().int().min(0).max(9999).optional(),
        is_active: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const dept = await getMyDept(supabase, userId);
    if (!dept) throw new Error("ไม่ได้กำหนดหน่วยงานในโปรไฟล์");
    const can = await isDeptAdmin(supabase, userId, dept);
    if (!can) throw new Error("เฉพาะผู้ดูแลหน่วยงานเท่านั้น");

    const payload = {
      department: dept,
      name: data.name,
      icon: data.icon ?? null,
      category: data.category ?? null,
      description: data.description ?? null,
      example_output: data.example_output ?? null,
      role_prompt: data.role_prompt,
      default_model_selector: data.default_model_selector ?? null,
      sort_order: data.sort_order ?? 0,
      is_active: data.is_active ?? true,
    };

    if (!data.id) {
      const { data: row, error } = await supabase
        .from("shared_skills")
        .insert({ ...payload, created_by: userId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: row.id as string };
    } else {
      const { error } = await supabase
        .from("shared_skills")
        .update(payload)
        .eq("id", data.id)
        .eq("department", dept);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
  });

export const deleteSharedSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const dept = await getMyDept(supabase, userId);
    if (!dept) throw new Error("ไม่ได้กำหนดหน่วยงานในโปรไฟล์");
    const can = await isDeptAdmin(supabase, userId, dept);
    if (!can) throw new Error("เฉพาะผู้ดูแลหน่วยงานเท่านั้น");
    const { error } = await supabase
      .from("shared_skills")
      .delete()
      .eq("id", data.id)
      .eq("department", dept);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Combined list (shared + personal) for selector UIs. */
export const listAvailableSkills = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const dept = await getMyDept(supabase, userId);
    const [sharedRes, personalRes] = await Promise.all([
      dept
        ? supabase
            .from("shared_skills")
            .select("id, name, icon, description, department")
            .eq("department", dept)
            .eq("is_active", true)
            .order("sort_order", { ascending: true })
        : Promise.resolve({ data: [] as Array<{ id: string; name: string; icon: string | null; description: string | null; department: string }> }),
      supabase
        .from("user_skills")
        .select("id, name, icon, description")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true }),
    ]);
    const shared: CombinedSkill[] = ((sharedRes.data ?? []) as Array<{ id: string; name: string; icon: string | null; description: string | null; department: string }>).map((s) => ({
      id: s.id,
      name: s.name,
      icon: s.icon,
      description: s.description,
      source: "shared" as const,
      department: s.department,
    }));
    const personal: CombinedSkill[] = ((personalRes.data ?? []) as Array<{ id: string; name: string; icon: string | null; description: string | null }>).map((s) => ({
      id: s.id,
      name: s.name,
      icon: s.icon,
      description: s.description,
      source: "personal" as const,
    }));
    return { shared, personal };
  });

/** Loader used by other server fns to inject shared-skill prompt block. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadSharedSkillPrompt(supabase: any, userId: string, skillId: string | null | undefined): Promise<string> {
  if (!skillId) return "";
  // RLS already restricts to the same department.
  const { data } = await supabase
    .from("shared_skills")
    .select("role_prompt, is_active")
    .eq("id", skillId)
    .maybeSingle();
  const prompt = data?.is_active ? ((data.role_prompt as string | null) ?? null) : null;
  if (!prompt) return "";
  void userId;
  return `\n\n<บทบาทที่หน่วยงานกำหนด>\n${prompt}\n</บทบาทที่หน่วยงานกำหนด>`;
}
