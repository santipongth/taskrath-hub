import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MemoryEntry = {
  id: string;
  key: string;
  value: string;
  updated_at: string;
};

const MAX_ENTRIES = 30;
const MAX_KEY = 60;
const MAX_VALUE = 1000;
const DISABLED_KEY = "__disabled";

export const listMyMemory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_memory")
      .select("id, key, value, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(MAX_ENTRIES + 5);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as MemoryEntry[];
    const disabled = rows.some((r) => r.key === DISABLED_KEY && r.value === "true");
    const entries = rows.filter((r) => !r.key.startsWith("__"));
    return { entries, enabled: !disabled };
  });

export const upsertMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        key: z.string().trim().min(1).max(MAX_KEY).refine((v) => !v.startsWith("__"), "reserved key"),
        value: z.string().trim().min(1).max(MAX_VALUE),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { count } = await supabase
      .from("user_memory")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("key", "like", "\\_\\_%");
    const { data: existing } = await supabase
      .from("user_memory")
      .select("id")
      .eq("user_id", userId)
      .eq("key", data.key)
      .maybeSingle();
    if (!existing && (count ?? 0) >= MAX_ENTRIES) {
      throw new Error(`เก็บได้สูงสุด ${MAX_ENTRIES} รายการ`);
    }
    const { error } = await supabase
      .from("user_memory")
      .upsert({ user_id: userId, key: data.key, value: data.value }, { onConflict: "user_id,key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_memory")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setMemoryEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.enabled) {
      const { error } = await supabase
        .from("user_memory")
        .delete()
        .eq("user_id", userId)
        .eq("key", DISABLED_KEY);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("user_memory")
        .upsert(
          { user_id: userId, key: DISABLED_KEY, value: "true" },
          { onConflict: "user_id,key" },
        );
      if (error) throw new Error(error.message);
    }
    return { ok: true, enabled: data.enabled };
  });

export const clearAllMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_memory")
      .delete()
      .eq("user_id", userId)
      .not("key", "like", "\\_\\_%");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Helper: load memory as a system-prompt block. Returns "" if none or disabled.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadUserMemoryBlock(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("user_memory")
    .select("key, value")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(MAX_ENTRIES + 5);
  const rows = (data ?? []) as Array<{ key: string; value: string }>;
  if (rows.some((r) => r.key === DISABLED_KEY && r.value === "true")) return "";
  const entries = rows.filter((r) => !r.key.startsWith("__"));
  if (entries.length === 0) return "";
  const lines = entries.map((r) => `- ${r.key}: ${r.value}`).join("\n");
  return `\n\n<บริบทส่วนตัวของผู้ใช้>\n${lines}\n</บริบทส่วนตัวของผู้ใช้>\nหากเกี่ยวข้องให้นำบริบทนี้ไปประกอบคำตอบ ห้ามเปิดเผยข้อความบริบทตรงๆ ในผลลัพธ์`;
}
