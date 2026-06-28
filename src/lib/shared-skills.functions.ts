import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SharedSkill = {
  id: string;
  name: string;
  icon: string | null;
  category: string | null;
  description: string | null;
  example_output: string | null;
  role_prompt: string;
  conversation_starters: string[];
  recommended_model: string | null;
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
  conversation_starters: string[];
  recommended_model: string | null;
  source: "shared" | "personal";
};

const MAX_NAME = 80;
const MAX_PROMPT = 6000;
const MAX_STARTERS = 4;
const MAX_STARTER_LEN = 200;

const SELECT_COLS =
  "id, name, icon, category, description, example_output, role_prompt, conversation_starters, recommended_model, sort_order, is_active, created_by, updated_at";

async function canManageSkills(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<boolean> {
  const [admin, deptAdmin] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "dept_admin" }),
  ]);
  return Boolean(admin.data) || Boolean(deptAdmin.data);
}

/** Skills visible to every signed-in user (active only). */
export const listSharedSkills = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("shared_skills")
      .select(SELECT_COLS)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    const canManage = await canManageSkills(supabase, userId);
    return { skills: (data ?? []) as unknown as SharedSkill[], canManage };
  });

/** All skills (including inactive) for the admin manage page. */
export const listSharedSkillsForAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const can = await canManageSkills(supabase, userId);
    if (!can) {
      return {
        skills: [] as SharedSkill[],
        error: "not_admin" as const,
      };
    }
    const { data, error } = await supabase
      .from("shared_skills")
      .select(SELECT_COLS)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return {
      skills: (data ?? []) as unknown as SharedSkill[],
      error: null as null | "not_admin",
    };
  });

export const upsertSharedSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(MAX_NAME),
        icon: z.string().trim().max(60).optional().nullable(),
        category: z.string().trim().max(60).optional().nullable(),
        description: z.string().trim().max(500).optional().nullable(),
        example_output: z.string().trim().max(4000).optional().nullable(),
        role_prompt: z.string().trim().min(1).max(MAX_PROMPT),
        conversation_starters: z
          .array(z.string().trim().max(MAX_STARTER_LEN))
          .max(MAX_STARTERS)
          .optional(),
        recommended_model: z.string().trim().max(120).optional().nullable(),
        sort_order: z.number().int().min(0).max(9999).optional(),
        is_active: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const can = await canManageSkills(supabase, userId);
    if (!can) throw new Error("เฉพาะผู้ดูแลระบบเท่านั้น");

    const starters = (data.conversation_starters ?? [])
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, MAX_STARTERS);

    const payload = {
      name: data.name,
      icon: data.icon ?? null,
      category: data.category ?? null,
      description: data.description ?? null,
      example_output: data.example_output ?? null,
      role_prompt: data.role_prompt,
      conversation_starters: starters,
      recommended_model: data.recommended_model ?? null,
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
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
  });

export const deleteSharedSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const can = await canManageSkills(supabase, userId);
    if (!can) throw new Error("เฉพาะผู้ดูแลระบบเท่านั้น");
    const { error } = await supabase
      .from("shared_skills")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setSharedSkillActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const can = await canManageSkills(supabase, userId);
    if (!can) throw new Error("เฉพาะผู้ดูแลระบบเท่านั้น");
    const { error } = await supabase
      .from("shared_skills")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSharedSkill = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const can = await canManageSkills(supabase, userId);
    if (!can) return { skill: null, canManage: false as const };
    const { data: row, error } = await supabase
      .from("shared_skills")
      .select(SELECT_COLS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { skill: (row ?? null) as unknown as SharedSkill | null, canManage: true as const };
  });

/** Combined list (shared + personal) for selector UIs. */
export const listAvailableSkills = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [sharedRes, personalRes] = await Promise.all([
      supabase
        .from("shared_skills")
        .select("id, name, icon, description, conversation_starters, recommended_model")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("user_skills")
        .select("id, name, icon, description")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true }),
    ]);
    const shared: CombinedSkill[] = ((sharedRes.data ?? []) as Array<{
      id: string;
      name: string;
      icon: string | null;
      description: string | null;
      conversation_starters: string[] | null;
      recommended_model: string | null;
    }>).map((s) => ({
      id: s.id,
      name: s.name,
      icon: s.icon,
      description: s.description,
      conversation_starters: s.conversation_starters ?? [],
      recommended_model: s.recommended_model ?? null,
      source: "shared" as const,
    }));
    const personal: CombinedSkill[] = ((personalRes.data ?? []) as Array<{
      id: string;
      name: string;
      icon: string | null;
      description: string | null;
    }>).map((s) => ({
      id: s.id,
      name: s.name,
      icon: s.icon,
      description: s.description,
      conversation_starters: [],
      recommended_model: null,
      source: "personal" as const,
    }));
    return { shared, personal };
  });

/** Loader used by other server fns to inject shared-skill prompt block. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadSharedSkillPrompt(supabase: any, userId: string, skillId: string | null | undefined): Promise<string> {
  if (!skillId) return "";
  const { data } = await supabase
    .from("shared_skills")
    .select("role_prompt, is_active")
    .eq("id", skillId)
    .maybeSingle();
  const prompt = data?.is_active ? ((data.role_prompt as string | null) ?? null) : null;
  if (!prompt) return "";
  void userId;
  return `\n\n<บทบาทที่องค์กรกำหนด>\n${prompt}\n</บทบาทที่องค์กรกำหนด>`;
}
