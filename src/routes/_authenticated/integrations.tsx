import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { Mail, FolderArchive, Building2, Calendar, MessageCircle, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ITEMS = [
  { icon: Mail, th: "อีเมลราชการ", en: "Government Email" },
  { icon: FolderArchive, th: "ระบบสารบรรณอิเล็กทรอนิกส์", en: "e-Office / e-Sarabun" },
  { icon: Building2, th: "GFMIS / งบประมาณ", en: "GFMIS / Budget" },
  { icon: Calendar, th: "Google Calendar", en: "Google Calendar" },
  { icon: MessageCircle, th: "LINE Official", en: "LINE Official" },
  { icon: Database, th: "ฐานข้อมูลกลาง", en: "Open Data" },
];

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({ meta: [{ title: "Integrations · RathCoWork" }] }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const { t, lang } = useI18n();
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-xl font-semibold text-foreground">{t("integrationsTitle")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("integrationsDesc")}</p>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((it) => (
          <div key={it.en} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-5">
            <div className="flex gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-primary">
                <it.icon className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{lang === "th" ? it.th : it.en}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{lang === "th" ? "เร็ว ๆ นี้" : "Coming soon"}</p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px]">{lang === "th" ? "เร็ว ๆ นี้" : "Soon"}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
