import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runFreeform, ocrAttachments } from "@/lib/ai.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TEMPLATES } from "@/lib/templates";
import { Sparkles, Copy, Paperclip, X, FileText, Image as ImageIcon, FileType2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { VoiceInputButton } from "@/components/voice-input-button";

export const Route = createFileRoute("/_authenticated/run/")({
  head: () => ({ meta: [{ title: "สั่งงาน AI · RathCoWork" }] }),
  component: RunPage,
});

type Attachment = {
  name: string;
  kind: "image" | "pdf" | "text";
  data: string;
  mime?: string;
  size: number;
  pages?: number;
  textLen?: number;
};

const MAX_FILES = 8;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|yaml|yml|log|html?|css|js|ts|tsx|jsx|py|sql)$/i;
const MAX_PDF_PAGES = 40;

const readAsDataUrl = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
const readAsText = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(f); });
const readAsArrayBuf = (f: File) => new Promise<ArrayBuffer>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.onerror = () => rej(r.error); r.readAsArrayBuffer(f); });

function estimatePdfPages(buf: ArrayBuffer): number {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  const matches = s.match(/\/Type\s*\/Page(?!s)/g);
  return matches?.length ?? 0;
}

function RunPage() {
  const { t, lang } = useI18n();
  const run = useServerFn(runFreeform);
  const ocr = useServerFn(ocrAttachments);
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [confirmedWarnings, setConfirmedWarnings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const baseRef = useRef("");

  const warnings = useMemo(() => {
    const w: string[] = [];
    for (const a of attachments) {
      if (a.size === 0) w.push(`${a.name}: ${lang === "th" ? "ไฟล์ว่าง/เสียหาย" : "empty/corrupt"}`);
      if (a.kind === "pdf" && a.pages !== undefined) {
        if (a.pages === 0) w.push(`${a.name}: ${lang === "th" ? "อ่านจำนวนหน้า PDF ไม่ได้ อาจเสียหาย" : "cannot read PDF pages"}`);
        else if (a.pages > MAX_PDF_PAGES) w.push(`${a.name}: ${lang === "th" ? `จำนวนหน้ามาก (${a.pages}) อาจใช้เวลานาน/โทเคนสูง` : `large (${a.pages} pages)`}`);
      }
      if (a.kind === "text" && (a.textLen ?? 0) < 20) w.push(`${a.name}: ${lang === "th" ? "ข้อความน้อยเกินไป" : "text too short"}`);
    }
    if (attachments.filter((a) => a.kind === "image").length > 5) w.push(lang === "th" ? "มีรูปภาพหลายไฟล์ อาจใช้เวลาประมวลผลนาน" : "many images attached");
    return w;
  }, [attachments, lang]);

  const onVoice = (chunk: string, isFinal: boolean) => {
    const sep = baseRef.current && !baseRef.current.endsWith(" ") ? " " : "";
    if (isFinal) { baseRef.current = (baseRef.current + sep + chunk).trimStart(); setPrompt(baseRef.current); }
    else setPrompt((baseRef.current + sep + chunk).trimStart());
  };

  const onFilesPicked = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setConfirmedWarnings(false);
    const next: Attachment[] = [...attachments];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_FILES) { toast.error(lang === "th" ? `แนบได้สูงสุด ${MAX_FILES} ไฟล์` : `Max ${MAX_FILES} files`); break; }
      if (file.size === 0) { toast.error(`${file.name}: ${lang === "th" ? "ไฟล์ว่าง/เสียหาย" : "empty/corrupt"}`); continue; }
      if (file.size > MAX_FILE_BYTES) { toast.error(`${file.name}: ${lang === "th" ? "ไฟล์ใหญ่เกิน 10MB" : "exceeds 10MB"}`); continue; }
      try {
        const mime = file.type || "";
        let kind: Attachment["kind"];
        let data: string;
        let pages: number | undefined;
        let textLen: number | undefined;
        if (mime.startsWith("image/")) {
          kind = "image"; data = await readAsDataUrl(file);
        } else if (mime === "application/pdf" || /\.pdf$/i.test(file.name)) {
          kind = "pdf";
          const buf = await readAsArrayBuf(file);
          pages = estimatePdfPages(buf);
          let bin = ""; const u8 = new Uint8Array(buf);
          for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
          data = `data:application/pdf;base64,${btoa(bin)}`;
        } else if (mime.startsWith("text/") || TEXT_EXT.test(file.name) || mime === "application/json") {
          kind = "text"; data = await readAsText(file); textLen = data.length;
        } else {
          toast.error(`${file.name}: ${lang === "th" ? "ชนิดไฟล์ไม่รองรับ" : "unsupported type"}`); continue;
        }
        next.push({ name: file.name, kind, data, mime, size: file.size, pages, textLen });
      } catch {
        toast.error(`${file.name}: ${lang === "th" ? "อ่านไฟล์ไม่สำเร็จ" : "read failed"}`);
      }
    }
    setAttachments(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (i: number) => { setAttachments(attachments.filter((_, idx) => idx !== i)); setConfirmedWarnings(false); };

  const onRun = async () => {
    if (!prompt.trim() && attachments.length === 0) return;
    if (warnings.length > 0 && !confirmedWarnings) {
      toast.warning(lang === "th" ? "พบคำเตือน — กด Run อีกครั้งเพื่อดำเนินการต่อ" : "Warnings — click Run again to continue");
      setConfirmedWarnings(true);
      return;
    }

    let workAtts = attachments;

    // OCR is always-on default: convert image/PDF → text attachments
    const targets = attachments.filter((a) => a.kind === "image" || a.kind === "pdf");
    if (targets.length > 0) {
      setOcrLoading(true);
      try {
        const res = await ocr({ data: { items: targets.map((a) => ({ name: a.name, dataUrl: a.data })) } });
        const map = new Map(res.results.map((r) => [r.name, r] as const));
        workAtts = attachments.map((a) => {
          if (a.kind !== "image" && a.kind !== "pdf") return a;
          const o = map.get(a.name);
          if (!o || o.error) { toast.error(`OCR ${a.name}: ${o?.error ?? "failed"}`); return a; }
          return { ...a, kind: "text" as const, data: o.text, mime: "text/plain", size: o.text.length, textLen: o.text.length };
        });
        setAttachments(workAtts);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "OCR error"); setOcrLoading(false); return;
      }
      setOcrLoading(false);
    }

    setLoading(true); setOutput("");
    try {
      const res = await run({
        data: {
          prompt: prompt.trim() || (lang === "th" ? "ช่วยวิเคราะห์/สรุปไฟล์แนบ" : "Please analyze the attached files"),
          attachments: workAtts.map(({ name, kind, data, mime, size }) => ({ name, kind, data, mime, size })),
        },
      });
      setOutput(res.output);
      setConfirmedWarnings(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const downloadOutput = () => {
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `ai-output-${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const iconFor = (k: Attachment["kind"]) =>
    k === "image" ? <ImageIcon className="h-3.5 w-3.5" /> : k === "pdf" ? <FileType2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />;
  const fmtSize = (b: number) => (b < 1024 ? `${b}B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)}KB` : `${(b / 1024 / 1024).toFixed(1)}MB`);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Sparkles className="h-5 w-5 text-primary" />{t("freeformTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("freeformDesc")}</p>
      </div>

      <div
        className="rounded-lg border border-border bg-card p-5"
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); onFilesPicked(e.dataTransfer.files); }}
      >
        <Textarea
          value={prompt}
          onChange={(e) => { baseRef.current = e.target.value; setPrompt(e.target.value); }}
          placeholder={t("freeformPlaceholder")}
          rows={6}
          className="resize-none border-border shadow-none focus-visible:ring-1"
        />

        {attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs">
                {iconFor(a.kind)}
                <span className="max-w-[180px] truncate">{a.name}</span>
                <span className="text-muted-foreground">
                  · {fmtSize(a.size)}{a.kind === "pdf" && a.pages !== undefined ? ` · ${a.pages}p` : ""}
                </span>
                <button onClick={() => removeAttachment(i)} className="ml-1 text-muted-foreground hover:text-foreground" aria-label="remove">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="mb-1 flex items-center gap-1.5 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              {lang === "th" ? "คำเตือนก่อนรัน" : "Pre-run warnings"}
            </div>
            <ul className="ml-5 list-disc space-y-0.5">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,text/*,.md,.csv,.tsv,.json,.xml,.yaml,.yml,.log,.html,.htm,.sql"
          className="hidden"
          onChange={(e) => onFilesPicked(e.target.files)}
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={loading || ocrLoading}>
              <Paperclip className="mr-1.5 h-3.5 w-3.5" />
              {lang === "th" ? "แนบไฟล์" : "Attach"}
            </Button>
            <p className="hidden text-xs text-muted-foreground sm:block">
              {lang === "th" ? "รูปภาพ · PDF · ข้อความ (≤10MB/ไฟล์) · OCR อัตโนมัติ" : "Images · PDF · text (≤10MB each) · auto OCR"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <VoiceInputButton onTranscript={onVoice} />
            <Button onClick={onRun} disabled={loading || ocrLoading || (!prompt.trim() && attachments.length === 0)}>
              {ocrLoading ? (lang === "th" ? "กำลัง OCR…" : "OCR…") : loading ? t("running") : warnings.length > 0 && confirmedWarnings ? (lang === "th" ? "รันต่อไป" : "Run anyway") : t("run")}
            </Button>
          </div>
        </div>
      </div>


      {output && (
        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("result")}</h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(output); toast.success(t("copied")); }}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />{t("copy")}
              </Button>
              <Button variant="ghost" size="sm" onClick={downloadOutput}>
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                {lang === "th" ? "ดาวน์โหลด .txt" : "Download .txt"}
              </Button>
            </div>
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
