import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { runTemplate, extractTextFromImage } from "@/lib/ai.functions";
import { TEMPLATES_BY_ID, type Template } from "@/lib/templates";
import { getCustomTemplateBySlug, type CustomTemplateField } from "@/lib/custom-templates.functions";
import { getTemplateIcon } from "@/lib/template-icons";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Copy, ImagePlus, ShieldCheck, RotateCcw, Pencil } from "lucide-react";
import { toast } from "sonner";
import { RefineBar } from "@/components/refine-bar";
import { ExportDialog } from "@/components/export-dialog";

type Revision = { output: string; instruction: string; preset?: string; at: string };

export const Route = createFileRoute("/_authenticated/run/$templateId")({
  head: ({ params }) => {
    const tpl = TEMPLATES_BY_ID[params.templateId];
    return { meta: [{ title: `${tpl?.titleTh ?? "Run"} · TaskRath` }] };
  },
  component: TemplateRunPage,
});

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function TemplateRunPage() {
  const { templateId } = Route.useParams();
  const builtIn = TEMPLATES_BY_ID[templateId];
  const { t, lang } = useI18n();
  const fetchCustom = useServerFn(getCustomTemplateBySlug);
  const { data: customData, isLoading: customLoading } = useQuery({
    queryKey: ["custom-template", templateId],
    queryFn: () => fetchCustom({ data: { slug: templateId } }),
    enabled: !builtIn,
  });

  const tpl: Template | null = useMemo(() => {
    if (builtIn) return builtIn;
    const c = customData?.template;
    if (!c) return null;
    return {
      id: c.slug,
      icon: getTemplateIcon(c.icon),
      titleTh: c.title_th,
      titleEn: c.title_en,
      descTh: c.desc_th,
      descEn: c.desc_en,
      category: c.category as Template["category"],
      systemPromptTh: c.system_prompt_th,
      fields: ((c.fields as unknown) as CustomTemplateField[]) ?? [],
    };
  }, [builtIn, customData]);

  const run = useServerFn(runTemplate);
  const ocr = useServerFn(extractTextFromImage);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [output, setOutput] = useState("");
  const [editingOutput, setEditingOutput] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [piiInfo, setPiiInfo] = useState<string>("");
  const [ocrLoading, setOcrLoading] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const draftKey = `taskrath:draft:${templateId}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        if (Object.values(parsed).some((v) => v && v.trim())) setHasDraft(true);
      }
    } catch { /* ignore */ }
  }, [draftKey]);

  useEffect(() => {
    const tt = setTimeout(() => {
      try {
        const hasAny = Object.values(inputs).some((v) => v && v.trim());
        if (hasAny) localStorage.setItem(draftKey, JSON.stringify(inputs));
      } catch { /* ignore */ }
    }, 500);
    return () => clearTimeout(tt);
  }, [inputs, draftKey]);

  const restoreDraft = () => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) setInputs(JSON.parse(raw));
      setHasDraft(false);
      toast.success(lang === "th" ? "กู้คืนฉบับร่างแล้ว" : "Draft restored");
    } catch { /* ignore */ }
  };
  const dismissDraft = () => { localStorage.removeItem(draftKey); setHasDraft(false); };

  const onRun = async () => {
    if (!tpl) return;
    setLoading(true); setOutput(""); setRunId(null); setPiiInfo(""); setRevisions([]); setEditingOutput(false);
    try {
      const res = await run({ data: { templateId, inputs } });
      setOutput(res.output);
      setRunId(res.id);
      setPiiInfo(res.pii ?? "");
      localStorage.removeItem(draftKey);
      setHasDraft(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !loading) { e.preventDefault(); onRun(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs, loading]);

  const onUpload = async (fieldName: string, file: File) => {
    if (!file.type.startsWith("image/")) { toast.error(lang === "th" ? "รองรับเฉพาะไฟล์รูปภาพ" : "Only image files supported"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error(lang === "th" ? "ไฟล์ต้องไม่เกิน 10MB" : "File must be <10MB"); return; }
    setOcrLoading(fieldName);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await ocr({ data: { dataUrl } });
      setInputs((p) => ({ ...p, [fieldName]: (p[fieldName] ? p[fieldName] + "\n\n" : "") + res.text }));
      toast.success(t("ocrSuccess"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "OCR error");
    } finally { setOcrLoading(null); }
  };

  if (!builtIn && customLoading) {
    return <div className="mx-auto max-w-4xl px-6 py-8 space-y-3"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  }
  if (!tpl) { throw notFound(); }
  const Icon = tpl.icon;

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

      {hasDraft && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm">
          <span className="inline-flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <RotateCcw className="h-4 w-4" />
            {lang === "th" ? "พบฉบับร่างที่ยังไม่ได้บันทึก" : "Unsaved draft found"}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={dismissDraft}>{lang === "th" ? "ยกเลิก" : "Dismiss"}</Button>
            <Button size="sm" variant="outline" onClick={restoreDraft}>{lang === "th" ? "กู้คืน" : "Restore"}</Button>
          </div>
        </div>
      )}

      <div className="space-y-4 rounded-lg border border-border bg-card p-5">
        {tpl.fields.map((f) => (
          <div key={f.name} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor={f.name} className="text-xs">
                {lang === "th" ? f.labelTh : f.labelEn}
                {f.required && <span className="ml-1 text-destructive">*</span>}
              </Label>
              {f.type === "textarea" && (
                <>
                  <input
                    ref={(el) => { fileRefs.current[f.name] = el; }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(f.name, file); e.target.value = ""; }}
                  />
                  <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px]" disabled={ocrLoading === f.name} onClick={() => fileRefs.current[f.name]?.click()}>
                    <ImagePlus className="mr-1 h-3 w-3" />
                    {ocrLoading === f.name ? t("ocrExtracting") : t("ocrUpload")}
                  </Button>
                </>
              )}
            </div>
            {f.type === "textarea" ? (
              <Textarea id={f.name} rows={5} value={inputs[f.name] ?? ""} onChange={(e) => setInputs((p) => ({ ...p, [f.name]: e.target.value }))} className="resize-none border-border shadow-none focus-visible:ring-1" />
            ) : (
              <Input id={f.name} value={inputs[f.name] ?? ""} onChange={(e) => setInputs((p) => ({ ...p, [f.name]: e.target.value }))} />
            )}
          </div>
        ))}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            {lang === "th" ? "PII จะถูกปกปิดก่อนส่ง AI" : "PII redacted before sending to AI"}
          </span>
          <div className="flex items-center gap-2">
            <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-block">⌘↵</kbd>
            <Button onClick={onRun} disabled={loading}>{loading ? t("running") : t("run")}</Button>
          </div>
        </div>
      </div>

      {output && (
        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">{t("result")}</h2>
              {piiInfo && <Badge variant="secondary" className="text-[10px]">{t("piiRedacted")}: {piiInfo}</Badge>}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditingOutput((v) => !v)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                {editingOutput ? (lang === "th" ? "เสร็จสิ้น" : "Done") : (lang === "th" ? "แก้ไข" : "Edit")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(output); toast.success(t("copied")); }}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />{t("copy")}
              </Button>
              {runId && (
                <ExportDialog
                  run={{ id: runId, output, created_at: new Date().toISOString(), template_id: templateId, input: inputs, title: lang === "th" ? tpl.titleTh : tpl.titleEn }}
                  templateTitle={lang === "th" ? tpl.titleTh : tpl.titleEn}
                />
              )}
            </div>
          </div>
          {editingOutput ? (
            <Textarea value={output} onChange={(e) => setOutput(e.target.value)} rows={Math.max(10, output.split("\n").length + 2)} className="resize-none font-sans text-sm leading-relaxed" />
          ) : (
            <pre className="whitespace-pre-wrap text-sm text-foreground">{output}</pre>
          )}
          {runId && (
            <RefineBar runId={runId} revisions={revisions} onUpdated={(newOutput, newRevisions) => { setOutput(newOutput); setRevisions(newRevisions); setEditingOutput(false); }} />
          )}
        </div>
      )}
    </div>
  );
}
