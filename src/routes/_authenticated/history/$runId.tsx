import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { getRun } from "@/lib/ai.functions";
import { TEMPLATES_BY_ID } from "@/lib/templates";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Copy, Download, Paperclip, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { ExportDialog } from "@/components/export-dialog";
import { RefineBar } from "@/components/refine-bar";

type Revision = { output: string; instruction: string; preset?: string; at: string };

export const Route = createFileRoute("/_authenticated/history/$runId")({
  head: () => ({ meta: [{ title: "รายละเอียดงาน · RathCoWork" }] }),
  component: RunDetail,
});

function RunDetail() {
  const { runId } = Route.useParams();
  const { t, lang } = useI18n();
  const fetch = useServerFn(getRun);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["run", runId],
    queryFn: () => fetch({ data: { id: runId } }),
  });

  const serverOutput = data?.run?.output ?? "";
  const serverRevisions = ((data?.run?.metadata as { revisions?: Revision[] } | null)?.revisions ?? []) as Revision[];
  const [output, setOutput] = useState(serverOutput);
  const [revisions, setRevisions] = useState<Revision[]>(serverRevisions);
  useEffect(() => {
    setOutput(serverOutput);
    setRevisions(serverRevisions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.run?.id, serverOutput]);

  // Realtime: stream backend step updates while the run is in progress.
  const runStatus = data?.run?.status;
  useEffect(() => {
    if (runStatus !== "running") return;
    const channel = supabase
      .channel(`ai_run_detail:${runId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ai_runs", filter: `id=eq.${runId}` },
        () => { qc.invalidateQueries({ queryKey: ["run", runId] }); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [runId, runStatus, qc]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!data?.run) return <p className="p-8 text-sm text-muted-foreground">{t("empty")}</p>;

  const run = data.run;
  const tpl = run.template_id ? TEMPLATES_BY_ID[run.template_id] : null;
  const inputObj = (run.input ?? {}) as Record<string, unknown>;
  const metaObj = (run.metadata ?? {}) as Record<string, unknown>;
  const metaDepth = (metaObj.depth as "fast" | "deep" | "custom" | undefined) ?? (inputObj.depth as "fast" | "deep" | undefined);
  const metaIntensity = (metaObj.intensity as "fast" | "deep" | "custom" | undefined) ?? (inputObj.intensity as "fast" | "deep" | "custom" | undefined) ?? metaDepth;
  const metaReportLength = (metaObj.reportLength as "short" | "medium" | "long" | undefined) ?? (inputObj.reportLength as "short" | "medium" | "long" | undefined);
  const metaMode = metaObj.mode as "search" | "provided" | undefined;
  const metaKind = metaObj.kind as string | undefined;
  const metaSources = Array.isArray(metaObj.sources) ? (metaObj.sources as Array<{ n: number; title: string; url: string; snippet?: string; relevance?: number; keypoints?: string[] }>) : [];
  const metaPlan = Array.isArray(metaObj.plan) ? (metaObj.plan as string[]) : [];
  const attachments = (Array.isArray((inputObj as { attachments?: unknown }).attachments)
    ? (inputObj as { attachments: Array<{ name: string; kind: string; mime?: string | null; size?: number | null }> }).attachments
    : []) as Array<{ name: string; kind: string; mime?: string | null; size?: number | null }>;
  const inputEntries = Object.entries(inputObj).filter(([k]) => k !== "attachments");

  const fmtSize = (b?: number | null) => {
    if (b == null) return "—";
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  };
  const downloadOutput = () => {
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `run-${runId}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link to="/history" className="mb-5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" />{t("back")}
      </Link>
      <h1 className="text-xl font-semibold text-foreground">
        {tpl ? (lang === "th" ? tpl.titleTh : tpl.titleEn) : (lang === "th" ? "สั่งงานอิสระ" : "Freeform")}
      </h1>
      <p className="mt-1 text-xs text-muted-foreground">
        {new Date(run.created_at).toLocaleString(lang === "th" ? "th-TH" : "en-US")}
      </p>

      {(run.status === "running" || run.status === "failed") && (() => {
        const step = metaObj.step as string | undefined;
        const labelTh = (metaObj.step_label_th as string | undefined) ?? "";
        const labelEn = (metaObj.step_label_en as string | undefined) ?? "";
        const prog = typeof metaObj.step_progress === "number" ? (metaObj.step_progress as number) : (step === "synthesize" ? 70 : step === "gather" ? 25 : 0);
        const isError = run.status === "failed" || step === "error";
        return (
          <div className={`mt-4 rounded-lg border p-4 ${isError ? "border-destructive/40 bg-destructive/5" : "border-primary/30 bg-primary/5"}`}>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              {isError
                ? <span className="text-destructive">{lang === "th" ? "เกิดข้อผิดพลาด" : "Error"}</span>
                : <><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /><span>{lang === "th" ? "กำลังประมวลผล" : "Processing"}</span></>}
            </div>
            <div className="mb-2 flex items-center gap-2 text-xs">
              <Badge variant={step === "gather" ? "default" : "outline"} className="text-[10px]">
                1. {lang === "th" ? "เตรียมแหล่งข้อมูล" : "Prepare sources"}
              </Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant={step === "synthesize" ? "default" : "outline"} className="text-[10px]">
                2. {lang === "th" ? "สังเคราะห์รายงาน" : "Synthesize report"}
              </Badge>
            </div>
            {!isError && <Progress value={prog} className="h-1.5" />}
            <p className={`mt-2 text-xs ${isError ? "text-destructive" : "text-muted-foreground"}`}>
              {(lang === "th" ? labelTh : labelEn) || (lang === "th" ? "กำลังทำงาน…" : "Working…")}
            </p>
          </div>
        );
      })()}

      {(metaIntensity || metaDepth || metaKind === "deep_research") && (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-card px-4 py-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">
              {lang === "th" ? "วิจัยเชิงลึก (multi-agent)" : "Deep Research (multi-agent)"}
            </span>
            {metaIntensity && (
              <Badge variant={metaIntensity === "deep" ? "default" : metaIntensity === "custom" ? "secondary" : "outline"} className="text-[10px]">
                {metaIntensity === "deep"
                  ? (lang === "th" ? "โหมดเชิงลึก" : "Deep mode")
                  : metaIntensity === "custom"
                    ? (lang === "th" ? "กำหนดเอง" : "Custom")
                    : (lang === "th" ? "โหมดเร็ว" : "Fast mode")}
              </Badge>
            )}
            {metaReportLength && (
              <Badge variant="outline" className="text-[10px]">
                {metaReportLength === "long" ? (lang === "th" ? "ยาว 1000–1500 คำ" : "Long 1000–1500w")
                  : metaReportLength === "medium" ? (lang === "th" ? "ปานกลาง 500–800 คำ" : "Medium 500–800w")
                  : (lang === "th" ? "สั้น 300–500 คำ" : "Short 300–500w")}
              </Badge>
            )}
            {metaMode && (
              <Badge variant="outline" className="text-[10px]">
                {metaMode === "provided"
                  ? (lang === "th" ? "จากแหล่งที่ระบุ" : "From provided sources")
                  : (lang === "th" ? "ค้นเว็บ" : "Web search")}
              </Badge>
            )}
            {metaSources.length > 0 && (
              <span className="text-muted-foreground">
                {lang === "th" ? `ใช้ ${metaSources.length} แหล่ง` : `${metaSources.length} sources used`}
              </span>
            )}
          </div>
          {metaPlan.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-medium text-muted-foreground">
                {lang === "th" ? "แผนคำค้นจาก Planner Agent:" : "Planner agent sub-queries:"}
              </div>
              <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
                {metaPlan.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {metaSources.length > 0 && (
        <div className="mt-4 rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">
            {lang === "th" ? `แหล่งข้อมูล (${metaSources.length})` : `Sources (${metaSources.length})`}
          </h2>
          <ol className="space-y-3 text-sm">
            {metaSources.map((s) => {
              const relPct = typeof s.relevance === "number" ? Math.round(s.relevance * 100) : null;
              const relColor = relPct == null ? "bg-muted text-muted-foreground" : relPct >= 75 ? "bg-primary/15 text-primary" : relPct >= 50 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground";
              return (
                <li key={s.n} className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">{s.n}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1 text-foreground hover:underline">
                        <span className="truncate">{s.title}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                      </a>
                      {relPct != null && (
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${relColor}`} title={lang === "th" ? "คะแนนความเกี่ยวข้อง" : "Relevance score"}>
                          {relPct}%
                        </span>
                      )}
                    </div>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 block truncate text-[11px] text-muted-foreground hover:underline">
                      {s.url}
                    </a>
                    {s.snippet && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.snippet}</p>}
                    {s.keypoints && s.keypoints.length > 0 && (
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
                        {s.keypoints.slice(0, 4).map((k, i) => <li key={i}>{k}</li>)}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="mt-6 rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold">{lang === "th" ? "ข้อมูลที่ป้อน" : "Inputs"}</h2>
        <dl className="space-y-2 text-sm">
          {inputEntries.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-foreground">{String(v)}</dd>
            </div>
          ))}
        </dl>
      </div>

      {attachments.length > 0 && (
        <div className="mt-4 rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <Paperclip className="h-3.5 w-3.5" />
            {lang === "th" ? "ไฟล์แนบ" : "Attachments"} ({attachments.length})
          </h2>
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{lang === "th" ? "ชื่อไฟล์" : "Name"}</th>
                  <th className="px-3 py-2 text-left font-medium">{lang === "th" ? "ชนิด" : "Kind"}</th>
                  <th className="px-3 py-2 text-left font-medium">MIME</th>
                  <th className="px-3 py-2 text-right font-medium">{lang === "th" ? "ขนาด" : "Size"}</th>
                </tr>
              </thead>
              <tbody>
                {attachments.map((a, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 text-foreground">{a.name}</td>
                    <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{a.kind}</Badge></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{a.mime ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">{fmtSize(a.size)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-lg border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{t("result")}</h2>
            {revisions.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {lang === "th" ? `ปรับ ${revisions.length} ครั้ง` : `${revisions.length} revisions`}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(output); toast.success(t("copied")); }}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />{t("copy")}
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadOutput}>
              <Download className="mr-1.5 h-3.5 w-3.5" />.txt
            </Button>
            <ExportDialog
              run={{ ...run, output }}
              templateTitle={tpl ? (lang === "th" ? tpl.titleTh : tpl.titleEn) : "Document"}
            />
          </div>
        </div>
        <pre className="whitespace-pre-wrap text-sm text-foreground">{output}</pre>
        <RefineBar
          runId={runId}
          revisions={revisions}
          onUpdated={(newOutput, newRevisions) => {
            setOutput(newOutput);
            setRevisions(newRevisions);
            qc.invalidateQueries({ queryKey: ["run", runId] });
          }}
        />
      </div>
    </div>
  );
}
