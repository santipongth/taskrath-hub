import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Public read-only feed of the requesting user's scheduled task events.
// Auth via ?token=<supabase_access_token> for calendar subscription clients.
export const Route = createFileRoute("/api/public/calendar/ics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token =
          url.searchParams.get("token") ||
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
          "";
        if (!token) return new Response("Missing token", { status: 401 });

        const supaUrl = process.env.SUPABASE_URL!;
        const supaKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient<Database>(supaUrl, supaKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userRes.user) return new Response("Unauthorized", { status: 401 });
        const userId = userRes.user.id;

        const since = new Date(); since.setDate(since.getDate() - 7);
        const { data: events } = await supabase
          .from("task_events")
          .select("id, task_id, start_at, end_at")
          .eq("user_id", userId)
          .gte("start_at", since.toISOString())
          .order("start_at", { ascending: true });
        const ids = (events ?? []).map((e) => e.task_id);
        const { data: tasks } = ids.length
          ? await supabase.from("tasks").select("id, title, description").in("id", ids).eq("user_id", userId)
          : { data: [] as Array<{ id: string; title: string; description: string | null }> };
        const taskById = new Map((tasks ?? []).map((t) => [t.id, t]));

        const lines: string[] = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//RathCoWork//Tasks//TH",
          "CALSCALE:GREGORIAN",
          "X-WR-CALNAME:RathCoWork Tasks",
        ];
        const fmt = (s: string) => s.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
        for (const e of events ?? []) {
          const t = taskById.get(e.task_id);
          if (!t) continue;
          lines.push("BEGIN:VEVENT");
          lines.push(`UID:${e.id}@rathcowork`);
          lines.push(`DTSTAMP:${fmt(new Date().toISOString())}`);
          lines.push(`DTSTART:${fmt(e.start_at)}`);
          lines.push(`DTEND:${fmt(e.end_at)}`);
          lines.push(`SUMMARY:${escapeIcs(t.title)}`);
          if (t.description) lines.push(`DESCRIPTION:${escapeIcs(t.description.slice(0, 500))}`);
          lines.push("END:VEVENT");
        }
        lines.push("END:VCALENDAR");

        return new Response(lines.join("\r\n"), {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'attachment; filename="rathcowork-tasks.ics"',
            "Cache-Control": "private, no-cache",
          },
        });
      },
    },
  },
});

function escapeIcs(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
