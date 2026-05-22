import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NotificationSettings = {
  lineEnabled: boolean;
  lineTargetId: string;
  lineBroadcast: boolean;
  notifyOnApproval: boolean;
  notifyOnComplete: boolean;
};

const DEFAULTS: NotificationSettings = {
  lineEnabled: false,
  lineTargetId: "",
  lineBroadcast: false,
  notifyOnApproval: true,
  notifyOnComplete: false,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data !== true) throw new Error("Forbidden: admin role required");
}

export const getNotificationSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotificationSettings> => {
    const { supabase } = context;
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "notifications")
      .maybeSingle();
    return { ...DEFAULTS, ...((data?.value as Partial<NotificationSettings>) ?? {}) };
  });

export const updateNotificationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        lineEnabled: z.boolean(),
        lineTargetId: z.string().max(200).default(""),
        lineBroadcast: z.boolean(),
        notifyOnApproval: z.boolean(),
        notifyOnComplete: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "notifications", value: data, updated_by: userId }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function callLine(path: string, body: unknown) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  const res = await fetch(`https://api.line.me/v2/bot/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LINE API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json().catch(() => ({}));
}

export const sendLineNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        message: z.string().min(1).max(4900),
        override: z
          .object({
            broadcast: z.boolean().optional(),
            targetId: z.string().max(200).optional(),
          })
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: row } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "notifications")
      .maybeSingle();
    const cfg = { ...DEFAULTS, ...((row?.value as Partial<NotificationSettings>) ?? {}) };

    if (!cfg.lineEnabled && !data.override) {
      return { ok: false, skipped: "line_disabled" as const };
    }

    const messages = [{ type: "text", text: data.message }];
    const broadcast = data.override?.broadcast ?? cfg.lineBroadcast;
    const target = data.override?.targetId ?? cfg.lineTargetId;

    if (broadcast) {
      await callLine("message/broadcast", { messages });
    } else {
      if (!target) throw new Error("LINE target ID is not configured");
      await callLine("message/push", { to: target, messages });
    }

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "line.notify",
      resource: broadcast ? "broadcast" : target,
      metadata: { length: data.message.length },
    });

    return { ok: true };
  });
