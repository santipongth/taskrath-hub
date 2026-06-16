import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runFreeform } from "@/lib/ai.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TEMPLATES } from "@/lib/templates";
import { Sparkles, Copy } from "lucide-react";
import { toast } from "sonner";
import { VoiceInputButton } from "@/components/voice-input-button";

export const Route = createFileRoute("/_authenticated/run/")({
  head: () => ({ meta: [{ title: "สั่งงาน AI · RathCoWork" }] }),
  component: RunPage,
});

function RunPage() {
  const { t, lang } = useI18n();
  const run = useServerFn(runFreeform);
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  // committed base text (without current interim chunk)
  const baseRef = useRef("");

  const onVoice = (chunk: string, isFinal: boolean) => {
    const sep = baseRef.current && !baseRef.current.endsWith(" ") ? " " : "";
    if (isFinal) {
      baseRef.current = (baseRef.current + sep + chunk).trimStart();
      setPrompt(baseRef.current);
    } else {
      setPrompt((baseRef.current + sep + chunk).trimStart());
    }
  };

  const onRun = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setOutput("");
    try {
      const res = await run({ data: { prompt } });
      setOutput(res.output);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Sparkles className="h-5 w-5 text-primary" />{t("freeformTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("freeformDesc")}</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t("freeformPlaceholder")}
          rows={6}
          className="resize-none border-border shadow-none focus-visible:ring-1"
        />
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {lang === "th" ? "หรือเลือกเทมเพลตเพื่อกรอกฟอร์มที่มีโครงสร้าง" : "Or pick a template for a structured form"}
          </p>
          <Button onClick={onRun} disabled={loading || !prompt.trim()}>
            {loading ? t("running") : t("run")}
          </Button>
        </div>
      </div>

      {output && (
        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("result")}</h2>
            <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(output); toast.success(t("copied")); }}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />{t("copy")}
            </Button>
          </div>
          <pre className="whitespace-pre-wrap text-sm text-foreground">{output}</pre>
        </div>
      )}

      <div className="mt-10">
        <h2 className="mb-3 text-sm font-semibold text-foreground">{t("quickActions")}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {TEMPLATES.slice(0, 8).map((tpl) => (
            <Link
              key={tpl.id}
              to="/run/$templateId"
              params={{ templateId: tpl.id }}
              className="rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-muted"
            >
              {lang === "th" ? tpl.titleTh : tpl.titleEn}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
