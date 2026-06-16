import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AGENTS, runAgent } from "@/lib/ai.functions";
import { useI18n } from "@/lib/i18n";
import { Bot, Copy, Sparkles, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { VoiceInputButton } from "@/components/voice-input-button";

export const Route = createFileRoute("/_authenticated/agents")({
  head: () => ({ meta: [{ title: "Agents · RathCoWork" }] }),
  component: AgentsPage,
});

function AgentsPage() {
  const { t, lang } = useI18n();
  const run = useServerFn(runAgent);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const active = AGENTS.find((a) => a.id === activeId) ?? null;

  const onPick = (id: string) => {
    setActiveId(id);
    setOutput("");
    setRunId(null);
    setPrompt("");
  };

  const onRun = async () => {
    if (!active || !prompt.trim()) return;
    setLoading(true);
    setOutput("");
    setRunId(null);
    try {
      const res = await run({ data: { agentId: active.id, prompt } });
      setOutput(res.output);
      setRunId(res.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("agentsTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("agentsDesc")}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2">
        {AGENTS.map((a) => {
          const isActive = a.id === activeId;
          return (
            <button
              key={a.id}
              onClick={() => onPick(a.id)}
              className={`text-left rounded-lg border bg-card p-5 transition-colors ${
                isActive ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-primary">
                  <Bot className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  {lang === "th" ? a.titleTh : a.titleEn}
                </h3>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {lang === "th" ? a.descTh : a.descEn}
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                {a.skills.map((s) => (
                  <span key={s} className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {s}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {active && (
        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">
              {lang === "th" ? `สั่งงาน ${active.titleTh}` : `Task ${active.titleEn}`}
            </h2>
          </div>
          <div className="relative">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              placeholder={active.placeholderTh}
              className="resize-none pr-10"
            />
            <div className="absolute right-1.5 top-1.5">
              <VoiceInputButton
                size="icon"
                onTranscript={(text, isFinal) => {
                  if (!isFinal) return;
                  setPrompt((p) => (p ? p + " " : "") + text);
                }}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={onRun} disabled={loading || !prompt.trim()}>
              {loading ? t("running") : t("run")}
            </Button>
          </div>

          {output && (
            <div className="mt-5 rounded-md border border-border bg-background p-4">
              <div className="mb-2 flex items-center justify-between">
                <Badge variant="secondary" className="text-[10px]">{t("result")}</Badge>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(output);
                      toast.success(t("copied"));
                    }}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    {t("copy")}
                  </Button>
                  {runId && (
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/history/$runId" params={{ runId }}>
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        {lang === "th" ? "เปิดในประวัติ" : "Open in history"}
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
              <pre className="whitespace-pre-wrap text-sm text-foreground">{output}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
