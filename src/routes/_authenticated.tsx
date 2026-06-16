import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  // Supabase session lives in localStorage (client-only). Disable SSR for the
  // protected subtree so the gate and child server-fn calls always run with
  // the user's bearer token available — otherwise the attacher sends no
  // Authorization header and protected serverFns 401.
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } as never });
    }
    return { userId: data.user.id, email: data.user.email ?? null };
  },
  component: AuthLayout,
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
