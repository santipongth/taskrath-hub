import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listFavorites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("template_favorites")
      .select("template_id")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ids: (data ?? []).map((r) => r.template_id) };
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ templateId: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("template_favorites")
      .select("id")
      .eq("user_id", userId)
      .eq("template_id", data.templateId)
      .maybeSingle();
    if (existing) {
      await supabase.from("template_favorites").delete().eq("id", existing.id);
      return { pinned: false };
    }
    await supabase
      .from("template_favorites")
      .insert({ user_id: userId, template_id: data.templateId });
    return { pinned: true };
  });
