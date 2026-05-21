import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  // beforeLoad runs on BOTH server and client. The server has no Supabase
  // session (localStorage-only), so it would always redirect to /login,
  // causing a redirect loop with the client-side session. Only gate on client.
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return { userId: null, email: null };
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } as never });
    }
    return { userId: data.user.id, email: data.user.email ?? null };
  },
  component: AuthLayout,
});
});

function AuthLayout() {
  const { email } = Route.useRouteContext();
  const [currentEmail, setCurrentEmail] = useState<string | null>(email);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setCurrentEmail(session?.user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);
  return (
    <AppShell userEmail={currentEmail}>
      <Outlet />
    </AppShell>
  );
}
