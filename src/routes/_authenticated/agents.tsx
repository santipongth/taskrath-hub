import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/agents")({
  head: () => ({ meta: [{ title: "Agents · TaskRath" }] }),
  component: AgentsPage,
});

const STUB_AGENTS = [
  { name: "Document Assistant", skills: ["summarize", "draft", "translate"] },
  { name: "Budget Analyst", skills: ["analyze", "forecast"] },
  { name: "Citizen Service Bot", skills: ["reply", "classify"] },
  { name: "Legal Researcher", skills: ["search", "summarize"] },
];

function AgentsPage() {
  const { t, lang } = useI18n();
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("agentsTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("agentsDesc")}</p>
        </div>
        <Badge variant="outline" className="text-xs">HiClaw {lang === "th" ? "เชื่อมต่ออัตโนมัติ" : "auto-connected"}</Badge>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STUB_AGENTS.map((a) => (
          <div key={a.name} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-primary">
                <Bot className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{a.name}</h3>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {a.skills.map((s) => (
                <span key={s} className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{s}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
