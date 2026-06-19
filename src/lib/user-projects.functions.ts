import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UserProject = {
  id: string;
  name: string;
  context: string | null;
  color: string | null;
  archived: boolean;
};

const MAX_PROJECTS = 50;
const MAX_NAME = 100;
const MAX_CONTEXT = 4000;

export const listMyProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_projects")
      .select("id, name, context, color, archived")
      .eq("user_id", userId)
      .order("archived", { ascending: true })
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { projects: (data ?? []) as UserProject[] };
  });

export const upsertProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(MAX_NAME),
        context: z.string().trim().max(MAX_CONTEXT).optional().nullable(),
        color: z.string().trim().max(20).optional().nullable(),
        archived: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.id) {
      const { count } = await supabase
        .from("user_projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if ((count ?? 0) >= MAX_PROJECTS) throw new Error(`สร้างได้สูงสุด ${MAX_PROJECTS} โปรเจกต์`);
      const { data: row, error } = await supabase
        .from("user_projects")
        .insert({
          user_id: userId,
          name: data.name,
          context: data.context ?? null,
          color: data.color ?? null,
          archived: data.archived ?? false,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: row.id as string };
    } else {
      const patch: Record<string, unknown> = { name: data.name };
      if (data.context !== undefined) patch.context = data.context;
      if (data.color !== undefined) patch.color = data.color;
      if (data.archived !== undefined) patch.archived = data.archived;
      const { error } = await supabase
        .from("user_projects")
        .update(patch)
        .eq("id", data.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_projects")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadProjectContext(supabase: any, userId: string, projectId: string | null | undefined): Promise<string> {
  if (!projectId) return "";
  const { data } = await supabase
    .from("user_projects")
    .select("name, context")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  const name = data?.name as string | undefined;
  const ctx = (data?.context as string | null | undefined) ?? null;
  if (!name) return "";
  const body = ctx ? `${name}\n${ctx}` : name;
  return `\n\n<บริบทโปรเจกต์ที่กำลังทำ>\n${body}\n</บริบทโปรเจกต์ที่กำลังทำ>`;
}
