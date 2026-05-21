import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { TEMPLATES, type TemplateCategory } from "@/lib/templates";
import { TemplateCard } from "@/components/template-card";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const CATS: (TemplateCategory | "all")[] = ["all", "meeting", "letter", "analysis", "legal", "citizen"];

export const Route = createFileRoute("/_authenticated/templates")({
  head: () => ({ meta: [{ title: "คลังงานสำเร็จรูป · TaskRath" }] }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<TemplateCategory | "all">("all");

  const filtered = useMemo(() => {
    return TEMPLATES.filter((tpl) => {
      if (cat !== "all" && tpl.category !== cat) return false;
      if (!q) return true;
      const hay = `${tpl.titleTh} ${tpl.titleEn} ${tpl.descTh} ${tpl.descEn}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [q, cat]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-xl font-semibold text-foreground">{t("nav_templates")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("quickActionsDesc")}</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="h-9 pl-9 shadow-none focus-visible:ring-1" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${cat === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              {lang === "th"
                ? { all: "ทั้งหมด", meeting: "ประชุม", letter: "หนังสือ", analysis: "วิเคราะห์", legal: "กฎหมาย", citizen: "ประชาชน" }[c]
                : { all: "All", meeting: "Meetings", letter: "Letters", analysis: "Analysis", legal: "Legal", citizen: "Citizen" }[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((tpl) => <TemplateCard key={tpl.id} template={tpl} />)}
      </div>
      {filtered.length === 0 && (
        <p className="mt-12 text-center text-sm text-muted-foreground">{t("empty")}</p>
      )}
    </div>
  );
}
