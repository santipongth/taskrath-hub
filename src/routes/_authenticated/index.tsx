import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { dashboardStats } from "@/lib/ai.functions";
import { listFavorites } from "@/lib/favorites.functions";
import { TEMPLATES, TEMPLATES_BY_ID } from "@/lib/templates";
import { TemplateCard } from "@/components/template-card";
import { useI18n } from "@/lib/i18n";
import { Sparkles, LibraryBig, Star } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "หน้าหลัก · RathCoWork" },
      { name: "description", content: "หน้าหลัก RathCoWork — เลือกเทมเพลต AI สำหรับร่างหนังสือราชการ สรุปการประชุม ตอบประชาชน และวิเคราะห์งบประมาณ สำหรับเจ้าหน้าที่ภาครัฐไทย" },
      { property: "og:title", content: "หน้าหลัก · RathCoWork" },
      { property: "og:description", content: "เลือกเทมเพลต AI สำหรับงานราชการของเจ้าหน้าที่ภาครัฐไทย" },
      { property: "og:url", content: "https://taskrath-hub.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://taskrath-hub.lovable.app/" }],
  }),
  component: Dashboard,
});

function useGreeting(t: (k: "greetingMorning" | "greetingAfternoon" | "greetingEvening") => string) {
  const [key, setKey] = useState<"greetingMorning" | "greetingAfternoon" | "greetingEvening">("greetingMorning");
  useEffect(() => {
    const h = new Date().getHours();
    setKey(h < 12 ? "greetingMorning" : h < 18 ? "greetingAfternoon" : "greetingEvening");
  }, []);
  return t(key);
}

function Dashboard() {
  const { t, lang } = useI18n();
  const greetingText = useGreeting(t);

  const { email } = Route.useRouteContext();
  const fetchStats = useServerFn(dashboardStats);
  const fetchFavs = useServerFn(listFavorites);
  const { data } = useQuery({ queryKey: ["dashboardStats"], queryFn: () => fetchStats() });
  const { data: favs } = useQuery({ queryKey: ["favorites"], queryFn: () => fetchFavs() });

  const favoriteSet = useMemo(() => new Set(favs?.ids ?? []), [favs]);
  const pinnedTemplates = useMemo(
    () => (favs?.ids ?? []).map((id) => TEMPLATES_BY_ID[id]).filter(Boolean),
    [favs],
  );

  const name = email?.split("@")[0] ?? t("defaultUser");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("appName")}</p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">
          {greetingText}, {name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("appTagline")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard icon={<Sparkles className="h-4 w-4" />} label={t("statRunsWeek")} value={data?.runsThisWeek ?? "—"} />
        <StatCard icon={<LibraryBig className="h-4 w-4" />} label={t("statTemplates")} value={TEMPLATES.length} />
      </div>

      {pinnedTemplates.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" fill="currentColor" />
            <h2 className="text-sm font-semibold text-foreground">{t("pinned")}</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pinnedTemplates.map((tpl) => <TemplateCard key={tpl.id} template={tpl} pinned />)}
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{t("quickActions")}</h2>
            <p className="text-xs text-muted-foreground">{t("quickActionsDesc")}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {TEMPLATES.map((tpl) => <TemplateCard key={tpl.id} template={tpl} pinned={favoriteSet.has(tpl.id)} />)}
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
