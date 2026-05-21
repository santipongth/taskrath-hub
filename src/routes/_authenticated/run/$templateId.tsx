import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runTemplate, requestApproval } from "@/lib/ai.functions";
import { TEMPLATES_BY_ID } from "@/lib/templates";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/run/$templateId")({
  head: ({ params }) => {
    const tpl = TEMPLATES_BY_ID[params.templateId];
    return { meta: [{ title: `${tpl?.titleTh ?? "Run"} · TaskRath` }] };
  },
  beforeLoad: ({ params }) => {
    if (!TEMPLATES_BY_ID[params.templateId]) throw notFound();
  },
  component: TemplateRunPage,
});

function TemplateRunPage() {
  const { templateId } = Route.useParams();
  const tpl = TEMPLATES_BY_ID[templateId];
  const { t, lang } = useI18n();
  const run = useServerFn(runTemplate);
  const reqApproval = useServerFn(requestApproval);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [output, setOutput] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const Icon = tpl.icon;

  const onRun = async () => {
    setLoading(true);
    setOutput("");
    setRunId(null);
    try {
      const res = await run({ data: { templateId, inputs } });
      setOutput(res.output);
      setRunId(res.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const onRequestApproval = async () => {
    if (!runId) return;
    try {
      await reqApproval({ data: { runId } });
      toast.success(lang === "th" ? "ส่งขออนุมัติแล้ว" : "Approval requested");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link to="/templates" className="mb-5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" />{t("back")}
      </Link>
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-primary">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">{lang === "th" ? tpl.titleTh : tpl.titleEn}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{lang === "th" ? tpl.descTh : tpl.descEn}</p>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-card p-5">
        {tpl.fields.map((f) => (
          <div key={f.name} className="space-y-1.5">
            <Label htmlFor={f.name} className="text-xs">
              {lang === "th" ? f.labelTh : f.labelEn}
              {f.required && <span className="ml-1 text-destructive">*</span>}
            </Label>
            {f.type === "textarea" ? (
              <Textarea
                id={f.name}
                rows={5}
                value={inputs[f.name] ?? ""}
                onChange={(e) => setInputs((p) => ({ ...p, [f.name]: e.target.value }))}
                className="resize-none border-border shadow-none focus-visible:ring-1"
              />
            ) : (
              <Input
                id={f.name}
                value={inputs[f.name] ?? ""}
                onChange={(e) => setInputs((p) => ({ ...p, [f.name]: e.target.value }))}
              />
            )}
          </div>
        ))}
        <div className="flex justify-end">
          <Button onClick={onRun} disabled={loading}>{loading ? t("running") : t("run")}</Button>
        </div>
      </div>

      {output && (
        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("result")}</h2>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(output); toast.success(t("copied")); }}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />{t("copy")}
              </Button>
              <Button variant="outline" size="sm" onClick={onRequestApproval}>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />{t("requestApproval")}
              </Button>
            </div>
          </div>
          <pre className="whitespace-pre-wrap text-sm text-foreground">{output}</pre>
        </div>
      )}
    </div>
  );
}
