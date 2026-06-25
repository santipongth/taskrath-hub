import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  prepareResearchSources,
  synthesizeResearchReport,
  type ResearchSource,
  type ResearchDoc,
} from "@/lib/research.functions";
import { listMyProjects } from "@/lib/user-projects.functions";
import { upsertProjectSource } from "@/lib/project-sources.functions";
import { listMySkills } from "@/lib/user-skills.functions";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Telescope, Copy, ExternalLink, FileText, Paperclip, X,
  Image as ImageIcon, FileType2, Link as LinkIcon,
  Loader2, CheckCircle2, Circle, AlertCircle, Save,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/research/")({
  head: () => ({ meta: [{ title: "Deep Research · RathCoWork" }] }),
  component: ResearchPage,
});

type Attachment = {
  name: string;
  kind: "image" | "pdf" | "text";
  data: string;
  mime?: string;
  size: number;
};

type Stage = "idle" | "plan" | "gather" | "extract" | "synthesize" | "done" | "error";
type Intensity = "fast" | "deep" | "custom";
type ReportLength = "short" | "medium" | "long";
type StepStatus = "pending" | "active" | "done" | "error";

const MAX_FILES = 6;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|yaml|yml|log|html?)$/i;

const readAsDataUrl = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
const readAsText = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(f); });

function StepRow({ status, label, detail }: { status: StepStatus; label: string; detail?: string }) {
  const Icon = status === "done" ? CheckCircle2 : status === "active" ? Loader2 : status === "error" ? AlertCircle : Circle;
  const color = status === "done" ? "text-primary" : status === "active" ? "text-primary" : status === "error" ? "text-destructive" : "text-muted-foreground/60";
  return (
    <li className="flex items-start gap-2 text-xs">
      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${color} ${status === "active" ? "animate-spin" : ""}`} />
      <div className="min-w-0 flex-1">
        <div className={status === "pending" ? "text-muted-foreground" : "text-foreground"}>{label}</div>
        {detail && <div className="mt-0.5 text-[11px] text-muted-foreground">{detail}</div>}
      </div>
    </li>
  );
}

function ResearchPage() {
  const { lang } = useI18n();
  const prepare = useServerFn(prepareResearchSources);
  const synthesize = useServerFn(synthesizeResearchReport);
  const listProjects = useServerFn(listMyProjects);
  const saveSource = useServerFn(upsertProjectSource);

  const [question, setQuestion] = useState("");
  const [urlsText, setUrlsText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [depth, setDepth] = useState<"fast" | "deep">("fast");
  const limit = depth === "fast" ? 4 : 10;
  const [report, setReport] = useState("");
  const [sources, setSources] = useState<ResearchSource[]>([]);
  const [stage, setStage] = useState<Stage>("idle");
  const [stageDetail, setStageDetail] = useState<string>("");
  const [stageProgress, setStageProgress] = useState<number>(0);
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [runId, setRunId] = useState<string | null>(null);
  const startedAtRef = useRef<number>(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saveProjectId, setSaveProjectId] = useState<string>("");

  const { data: projData } = useQuery({
    queryKey: ["my-projects"],
    queryFn: () => listProjects(),
  });
  const projects = useMemo(() => projData?.projects.filter((p) => !p.archived) ?? [], [projData]);

  // Prefill from /tasks "ทำเลย" or notebook hub
  useEffect(() => {
    try {
      const p = sessionStorage.getItem("research:prefill");
      if (p) { setQuestion(p); sessionStorage.removeItem("research:prefill"); }
      const u = sessionStorage.getItem("research:urls");
      if (u) { setUrlsText(u); sessionStorage.removeItem("research:urls"); }
    } catch { /* ignore */ }
  }, []);

  const parsedUrls = urlsText.split(/\s+/).map((s) => s.trim()).filter((s) => /^https?:\/\//i.test(s));
  const hasProvided = parsedUrls.length > 0 || attachments.length > 0;
  const loading = stage === "gather" || stage === "synthesize";
  const progressValue = stageProgress > 0
    ? stageProgress
    : stage === "idle" ? 0 : stage === "gather" ? 35 : stage === "synthesize" ? 75 : 100;

  useEffect(() => {
    if (!loading) return;
    startedAtRef.current = startedAtRef.current || Date.now();
    const id = window.setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 250);
    return () => window.clearInterval(id);
  }, [loading]);

  // Realtime: subscribe to the active run row and reflect backend step updates.
  useEffect(() => {
    if (!runId) return;
    const channel = supabase
      .channel(`ai_run:${runId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ai_runs", filter: `id=eq.${runId}` },
        (payload) => {
          const row = payload.new as { status?: string; metadata?: Record<string, unknown> | null };
          const meta = (row.metadata ?? {}) as Record<string, unknown>;
          const step = meta.step as Stage | undefined;
          const labelTh = (meta.step_label_th as string | undefined) ?? "";
          const labelEn = (meta.step_label_en as string | undefined) ?? "";
          const prog = typeof meta.step_progress === "number" ? (meta.step_progress as number) : 0;
          if (step === "gather" || step === "synthesize") setStage(step);
          else if (step === "done" || row.status === "completed") setStage("done");
          else if (step === "error" || row.status === "failed") setStage("error");
          setStageDetail(lang === "th" ? labelTh : labelEn);
          if (prog > 0) setStageProgress(prog);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [runId, lang]);

  const onSaveToProject = async () => {
    if (!saveProjectId) { toast.error(lang === "th" ? "เลือก Notebook ก่อน" : "Select notebook"); return; }
    try {
      await saveSource({
        data: {
          project_id: saveProjectId,
          kind: "research",
          title: question.trim().slice(0, 180) || "Research report",
          content_md: report,
          metadata: { sources: sources.map((s) => ({ n: s.n, title: s.title, url: s.url })) },
        },
      });
      toast.success(lang === "th" ? "บันทึกใน Notebook แล้ว" : "Saved to notebook");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };


  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: Attachment[] = [];
    for (const f of Array.from(files)) {
      if (attachments.length + next.length >= MAX_FILES) {
        toast.error(lang === "th" ? `แนบได้สูงสุด ${MAX_FILES} ไฟล์` : `Max ${MAX_FILES} files`);
        break;
      }
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`${f.name}: ${lang === "th" ? "ไฟล์ใหญ่เกิน 10MB" : "exceeds 10MB"}`);
        continue;
      }
      const isImage = f.type.startsWith("image/");
      const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
      const isText = !isImage && !isPdf && (f.type.startsWith("text/") || TEXT_EXT.test(f.name));
      try {
        if (isImage) next.push({ name: f.name, kind: "image", data: await readAsDataUrl(f), mime: f.type, size: f.size });
        else if (isPdf) next.push({ name: f.name, kind: "pdf", data: await readAsDataUrl(f), mime: "application/pdf", size: f.size });
        else if (isText) next.push({ name: f.name, kind: "text", data: await readAsText(f), mime: f.type, size: f.size });
        else toast.error(`${f.name}: ${lang === "th" ? "ชนิดไฟล์ไม่รองรับ" : "unsupported type"}`);
      } catch {
        toast.error(`${f.name}: read error`);
      }
    }
    if (next.length) setAttachments((prev) => [...prev, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeAtt = (i: number) => setAttachments((p) => p.filter((_, idx) => idx !== i));

  const onRun = async () => {
    if (question.trim().length < 5) {
      toast.error(lang === "th" ? "พิมพ์คำถามอย่างน้อย 5 ตัวอักษร" : "Question too short");
      return;
    }
    setReport(""); setSources([]); setFailedUrls([]);
    setRunId(null); setStageProgress(0);
    startedAtRef.current = Date.now(); setElapsedMs(0);
    setStage("gather");

    try {
      const depthLabel = depth === "deep"
        ? (lang === "th" ? "เชิงลึก" : "Deep")
        : (lang === "th" ? "เร็ว" : "Fast");
      setStageDetail(
        hasProvided
          ? (lang === "th" ? `[โหมด${depthLabel}] กำลังดึงเนื้อหาจาก ${parsedUrls.length} ลิงก์…` : `[${depthLabel} mode] Fetching ${parsedUrls.length} link(s)…`)
          : (lang === "th" ? `[โหมด${depthLabel}] กำลังค้นเว็บสูงสุด ${limit} แหล่ง…` : `[${depthLabel} mode] Searching the web for up to ${limit} sources…`),
      );

      const prepared = await prepare({
        data: {
          question: question.trim(),
          limit,
          depth,
          lang,
          urls: parsedUrls,
          hasAttachments: attachments.length > 0,
        },
      });
      setRunId(prepared.runId);
      setSources(prepared.sources);
      setFailedUrls(prepared.failed ?? []);

      setStage("synthesize");
      setStageDetail(
        lang === "th"
          ? `[โหมด${depthLabel}] กำลังสรุปจาก ${prepared.sources.length} แหล่ง${attachments.length ? ` + ${attachments.length} ไฟล์` : ""}…`
          : `[${depthLabel} mode] Synthesizing from ${prepared.sources.length} sources${attachments.length ? ` + ${attachments.length} files` : ""}…`,
      );

      const docs = prepared.docs as ResearchDoc[];
      const r = await synthesize({
        data: {
          runId: prepared.runId,
          question: question.trim(),
          lang,
          docs,
          attachments: attachments.map((a) => ({ name: a.name, kind: a.kind, data: a.data, mime: a.mime, size: a.size })),
          mode: prepared.mode,
          depth,
        },
      });
      setReport(r.report);
      setSources(r.sources);
      setStage("done");
      setStageProgress(100);
      setStageDetail("");
      toast.success(
        depth === "deep"
          ? (lang === "th" ? "รายงานเชิงลึกพร้อมแล้ว" : "Deep report ready")
          : (lang === "th" ? "รายงานพร้อมแล้ว" : "Report ready"),
      );
    } catch (e) {
      setStage("error");
      setStageDetail(e instanceof Error ? e.message : "Error");
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const downloadReport = () => {
    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `research-${Date.now()}.md`; a.click();
    URL.revokeObjectURL(url);
  };

  const elapsedLabel = `${(elapsedMs / 1000).toFixed(1)}s`;
  const gatherStatus: StepStatus = stage === "idle" ? "pending" : stage === "gather" ? "active" : stage === "error" && sources.length === 0 ? "error" : "done";
  const synthStatus: StepStatus = stage === "synthesize" ? "active" : stage === "done" ? "done" : stage === "error" && sources.length > 0 ? "error" : "pending";

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Telescope className="h-5 w-5 text-primary" />
          {lang === "th" ? "วิจัยเชิงลึก" : "Deep Research"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {lang === "th"
            ? "ค้นเว็บ หรือใส่ลิงก์/ไฟล์เอง แล้วระบบจะดึงเนื้อหามาสรุปเป็นรายงานพร้อมการอ้างอิง [n]"
            : "Search the web, or paste links / drop files — get a cited Markdown report"}
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-card p-5">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={lang === "th" ? "เช่น สรุปสาระสำคัญของ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 และผลกระทบต่อหน่วยงานราชการ" : "e.g. Summarize the Thai PDPA and its impact on government agencies"}
          rows={3}
          disabled={loading}
          className="resize-none border-border shadow-none focus-visible:ring-1"
        />

        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <LinkIcon className="h-3.5 w-3.5" />
            {lang === "th" ? "ลิงก์ที่ให้ระบบดึง (วางได้หลายลิงก์ คั่นด้วยช่องว่าง/บรรทัด)" : "URLs to fetch (space or newline separated)"}
          </label>
          <Textarea
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            placeholder="https://www.example.go.th/regulation https://www.ratchakitcha.soc.go.th/..."
            rows={2}
            disabled={loading}
            className="resize-none border-border font-mono text-xs shadow-none focus-visible:ring-1"
          />
          {parsedUrls.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {lang === "th" ? `จะดึง ${parsedUrls.length} ลิงก์` : `${parsedUrls.length} link(s) detected`}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Paperclip className="h-3.5 w-3.5" />
              {lang === "th" ? "ไฟล์แนบ (รูป/PDF/ข้อความ)" : "Attachments (image/PDF/text)"}
            </span>
            <Button variant="ghost" size="sm" type="button" onClick={() => fileRef.current?.click()} disabled={loading || attachments.length >= MAX_FILES}>
              <Paperclip className="mr-1 h-3.5 w-3.5" />{lang === "th" ? "แนบไฟล์" : "Attach"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,application/pdf,text/*,.md,.csv,.tsv,.json,.xml,.yaml,.yml,.log,.html"
              className="hidden"
              onChange={(e) => onPickFiles(e.target.files)}
            />
          </div>
          {attachments.length > 0 && (
            <ul className="space-y-1">
              {attachments.map((a, i) => (
                <li key={`${a.name}-${i}`} className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs">
                  {a.kind === "image" ? <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" /> : a.kind === "pdf" ? <FileType2 className="h-3.5 w-3.5 text-muted-foreground" /> : <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  <span className="text-muted-foreground">{(a.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => removeAtt(i)} aria-label="remove" disabled={loading} className="text-muted-foreground hover:text-destructive disabled:opacity-50">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div className="inline-flex rounded-md border border-border bg-background p-0.5">
            <button
              type="button"
              onClick={() => setDepth("fast")}
              disabled={loading}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${depth === "fast" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {lang === "th" ? "โหมดเร็ว (Fast)" : "Fast Mode"}
            </button>
            <button
              type="button"
              onClick={() => setDepth("deep")}
              disabled={loading}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${depth === "deep" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {lang === "th" ? "โหมดเชิงลึก (Deep)" : "Deep Mode"}
            </button>
          </div>
          <Button onClick={onRun} disabled={loading || question.trim().length < 5}>
            {loading
              ? (depth === "deep"
                  ? (lang === "th" ? "กำลังวิจัยเชิงลึก…" : "Deep researching…")
                  : (lang === "th" ? "กำลังวิจัย…" : "Researching…"))
              : hasProvided
                ? (lang === "th"
                    ? (depth === "deep" ? "วิจัยเชิงลึกจากแหล่งที่ระบุ" : "วิจัยจากแหล่งที่ระบุ")
                    : (depth === "deep" ? "Deep research from sources" : "Research from sources"))
                : (lang === "th"
                    ? (depth === "deep" ? "ค้นเว็บและวิจัยเชิงลึก" : "ค้นเว็บและวิจัย")
                    : (depth === "deep" ? "Search & deep research" : "Search & research"))}
          </Button>

        </div>
      </div>

      {(stage !== "idle") && (
        <div className="mt-4 rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">
                {stage === "done"
                  ? (lang === "th" ? "เสร็จสิ้น" : "Complete")
                  : stage === "error"
                    ? (lang === "th" ? "เกิดข้อผิดพลาด" : "Error")
                    : (lang === "th" ? "กำลังประมวลผล" : "Processing")}
              </h2>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${depth === "deep" ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground"}`}>
                {depth === "deep"
                  ? (lang === "th" ? `เชิงลึก · สูงสุด ${limit} แหล่ง` : `Deep · up to ${limit} sources`)
                  : (lang === "th" ? `เร็ว · สูงสุด ${limit} แหล่ง` : `Fast · up to ${limit} sources`)}
              </span>
            </div>
            <span className="font-mono text-xs text-muted-foreground">{elapsedLabel}</span>
          </div>
          <Progress value={progressValue} className="h-1.5" />
          <ul className="mt-3 space-y-1.5">
            <StepRow
              status={gatherStatus}
              label={
                (lang === "th" ? "1. เตรียมแหล่งข้อมูล — " : "1. Prepare sources — ") +
                (hasProvided
                  ? (lang === "th" ? "ดึงเนื้อหาจากลิงก์ที่ระบุ" : "fetch provided links")
                  : depth === "deep"
                    ? (lang === "th" ? `ค้นเว็บแบบกว้าง (สูงสุด ${limit} แหล่ง)` : `broad web search (up to ${limit} sources)`)
                    : (lang === "th" ? `ค้นเว็บแบบเร็ว (สูงสุด ${limit} แหล่ง)` : `fast web search (up to ${limit} sources)`))
              }
              detail={
                gatherStatus === "active" ? stageDetail :
                gatherStatus === "done" ? (lang === "th" ? `พบ ${sources.length} แหล่ง` : `${sources.length} sources`) +
                  (failedUrls.length ? (lang === "th" ? ` (พลาด ${failedUrls.length} ลิงก์)` : ` (${failedUrls.length} failed)`) : "") :
                undefined
              }
            />
            <StepRow
              status={synthStatus}
              label={
                (lang === "th" ? "2. สังเคราะห์รายงาน — " : "2. Synthesize report — ") +
                (depth === "deep"
                  ? (lang === "th" ? "วิเคราะห์ละเอียด เปรียบเทียบหลายมุมมอง (800–1200 คำ)" : "thorough analysis with cross-source comparison (800–1200 words)")
                  : (lang === "th" ? "สรุปกระชับ เน้นประเด็นสำคัญ (300–500 คำ)" : "concise key-point summary (300–500 words)"))
              }
              detail={synthStatus === "active" ? stageDetail : undefined}
            />
            {stage === "error" && (
              <li className="mt-1 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                {stageDetail}
              </li>
            )}
          </ul>
          {failedUrls.length > 0 && (
            <div className="mt-3 rounded-md border border-border bg-muted/40 p-2 text-[11px] text-muted-foreground">
              <div className="mb-1 font-medium">{lang === "th" ? "ลิงก์ที่ดึงไม่สำเร็จ:" : "Failed to fetch:"}</div>
              <ul className="space-y-0.5">
                {failedUrls.map((u) => <li key={u} className="truncate">• {u}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {sources.length > 0 && stage !== "gather" && (
        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">{lang === "th" ? "แหล่งข้อมูลที่ใช้" : "Sources"}</h2>
          <ol className="space-y-2 text-sm">
            {sources.map((s) => (
              <li key={s.n} className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">{s.n}</span>
                <div className="min-w-0 flex-1">
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-foreground hover:underline">
                    <span className="truncate">{s.title}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </a>
                  {s.snippet && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{s.snippet}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {report && (
        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{lang === "th" ? "รายงาน" : "Report"}</h2>
            <div className="flex flex-wrap items-center gap-1">
              {projects.length > 0 && (
                <>
                  <Select value={saveProjectId} onValueChange={setSaveProjectId}>
                    <SelectTrigger className="h-8 w-44 text-xs">
                      <SelectValue placeholder={lang === "th" ? "เลือก Notebook…" : "Select notebook…"} />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="secondary" size="sm" onClick={onSaveToProject} disabled={!saveProjectId}>
                    <Save className="mr-1.5 h-3.5 w-3.5" />{lang === "th" ? "บันทึกใน Notebook" : "Save to notebook"}
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(report); toast.success(lang === "th" ? "คัดลอกแล้ว" : "Copied"); }}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />{lang === "th" ? "คัดลอก" : "Copy"}
              </Button>
              <Button variant="ghost" size="sm" onClick={downloadReport}>
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                {lang === "th" ? "ดาวน์โหลด .md" : "Download .md"}
              </Button>
            </div>
          </div>
          <pre className="whitespace-pre-wrap text-sm text-foreground">{report}</pre>
        </div>
      )}
    </div>
  );
}
