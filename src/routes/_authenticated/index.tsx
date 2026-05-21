import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { dashboardStats } from "@/lib/ai.functions";
import { TEMPLATES } from "@/lib/templates";
import { TemplateCard } from "@/components/template-card";
import { useI18n } from "@/lib/i18n";
import { Sparkles, ListChecks, LibraryBig } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "หน้าหลัก · TaskRath" }] }),
  component: Dashboard,
});

function useGreeting(t: (k: "greetingMorning" | "greetingAfternoon" | "greetingEvening") => string) {
  // Render a stable value on SSR + first client paint, then swap in time-based greeting after mount to avoid hydration mismatch.
  const [key, setKey] = useState<"greetingMorning" | "greetingAfternoon" | "greetingEvening">("greetingMorning");
  useEffect(() => {
    const h = new Date().getHours();
    setKey(h < 12 ? "greetingMorning" : h < 18 ? "greetingAfternoon" : "greetingEvening");
  }, []);
  return t(key);
}


function Dashboard() {
  const { t, lang } = useI18n();
  const { email } = Route.useRouteContext();
  const fetchStats = useServerFn(dashboardStats);
  const { data } = useQuery({ queryKey: ["dashboardStats"], queryFn: () => fetchStats() });

  const name = email?.split("@")[0] ?? (lang === "th" ? "ผู้ใช้งาน" : "there");

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("appName")}</p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">
          {greeting(t)}, {name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("appTagline")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={<Sparkles className="h-4 w-4" />} label={t("statRunsWeek")} value={data?.runsThisWeek ?? "—"} />
        <StatCard icon={<ListChecks className="h-4 w-4" />} label={t("statPending")} value={data?.pendingApprovals ?? "—"} />
        <StatCard icon={<LibraryBig className="h-4 w-4" />} label={t("statTemplates")} value={TEMPLATES.length} />
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t("quickActions")}</h2>
            <p className="text-xs text-muted-foreground">{t("quickActionsDesc")}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {TEMPLATES.map((tpl) => <TemplateCard key={tpl.id} template={tpl} />)}
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="text-primary">{icon}</span>{label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}
