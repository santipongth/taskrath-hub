import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// pg_cron calls this endpoint every 15 minutes to send LINE reminders for upcoming events.
export const Route = createFileRoute("/api/public/hooks/task-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("apikey") || "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || "";
        if (!auth || auth !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const now = new Date();
        const cutoff = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour window

        const { data: events, error } = await supabase
          .from("task_events")
          .select("id, task_id, user_id, start_at, remind_at")
          .lte("remind_at", cutoff.toISOString())
          .gte("remind_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
          .is("reminded_at", null)
          .limit(200);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        const eventList = events ?? [];
        if (eventList.length === 0) return Response.json({ ok: true, sent: 0 });

        // Load tasks + notif settings
        const taskIds = eventList.map((e) => e.task_id);
        const { data: tasks } = await supabase.from("tasks").select("id, title").in("id", taskIds);
        const taskTitle = new Map((tasks ?? []).map((t) => [t.id, t.title as string]));

        const { data: settingsRow } = await supabase.from("app_settings").select("value").eq("key", "notifications").maybeSingle();
        const cfg = (settingsRow?.value as { lineEnabled?: boolean; lineBroadcast?: boolean; lineTargetId?: string } | null) ?? null;

        const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        let sent = 0;
        if (cfg?.lineEnabled && token) {
          for (const e of eventList) {
            const title = taskTitle.get(e.task_id) ?? "งาน";
            const start = new Date(e.start_at).toLocaleString("th-TH", {
              weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
            });
            const text = `⏰ ใกล้ถึงเวลางาน: ${title}\n${start}`;
            const messages = [{ type: "text", text }];
            try {
              const url = cfg.lineBroadcast
                ? "https://api.line.me/v2/bot/message/broadcast"
                : "https://api.line.me/v2/bot/message/push";
              const body = cfg.lineBroadcast
                ? { messages }
                : cfg.lineTargetId ? { to: cfg.lineTargetId, messages } : null;
              if (body) {
                const res = await fetch(url, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                  body: JSON.stringify(body),
                });
                if (res.ok) sent++;
              }
            } catch {
              /* swallow */
            }
          }
        }

        // Mark all as reminded regardless to avoid spamming when LINE is off
        await supabase
          .from("task_events")
          .update({ reminded_at: now.toISOString() })
          .in("id", eventList.map((e) => e.id));

        return Response.json({ ok: true, sent, checked: eventList.length });
      },
    },
  },
});
