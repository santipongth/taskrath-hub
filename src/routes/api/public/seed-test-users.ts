import { createFileRoute } from "@tanstack/react-router";

const TOKEN = "rathcowork-seed-2026-06-16-x9k2";

export const Route = createFileRoute("/api/public/seed-test-users")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("x-seed-token");
        if (auth !== TOKEN) return new Response("forbidden", { status: 403 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const users = [
          { email: "user@test.rathcowork.local", password: "TestUser!2026", role: "user", display_name: "Test User" },
          { email: "admin@test.rathcowork.local", password: "TestAdmin!2026", role: "admin", display_name: "Test Admin" },
        ];
        const out: Array<{ email: string; id?: string; error?: string }> = [];
        for (const u of users) {
          const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: u.email,
            password: u.password,
            email_confirm: true,
            user_metadata: { display_name: u.display_name },
          });
          if (error) {
            // try lookup
            const { data: list } = await supabaseAdmin.auth.admin.listUsers();
            const existing = list?.users.find((x) => x.email === u.email);
            if (!existing) {
              out.push({ email: u.email, error: error.message });
              continue;
            }
            // update password
            await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: u.password });
            if (u.role === "admin") {
              await supabaseAdmin.from("user_roles").upsert({ user_id: existing.id, role: "admin" }, { onConflict: "user_id,role" });
            }
            out.push({ email: u.email, id: existing.id });
            continue;
          }
          if (u.role === "admin" && data.user) {
            await supabaseAdmin.from("user_roles").upsert({ user_id: data.user.id, role: "admin" }, { onConflict: "user_id,role" });
          }
          out.push({ email: u.email, id: data.user?.id });
        }
        return Response.json({ ok: true, users: out });
      },
    },
  },
});
