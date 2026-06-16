import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runFreeform } from "@/lib/ai.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TEMPLATES } from "@/lib/templates";
import { Sparkles, Copy, Paperclip, X, FileText, Image as ImageIcon, FileType2 } from "lucide-react";
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
};

const MAX_FILES = 8;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|yaml|yml|log|html?|css|js|ts|tsx|jsx|py|sql)$/i;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

function RunPage() {
  const { t, lang } = useI18n();
  const run = useServerFn(runFreeform);
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const onFilesPicked = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: Attachment[] = [...attachments];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_FILES) {
        toast.error(lang === "th" ? `แนบได้สูงสุด ${MAX_FILES} ไฟล์` : `Max ${MAX_FILES} files`);
        break;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name}: ${lang === "th" ? "ไฟล์ใหญ่เกิน 10MB" : "exceeds 10MB"}`);
        continue;
      }
      try {
        const mime = file.type || "";
        let kind: Attachment["kind"];
        let data: string;
        if (mime.startsWith("image/")) {
          kind = "image";
          data = await readAsDataUrl(file);
        } else if (mime === "application/pdf" || /\.pdf$/i.test(file.name)) {
          kind = "pdf";
          data = await readAsDataUrl(file);
        } else if (mime.startsWith("text/") || TEXT_EXT.test(file.name) || mime === "application/json") {
          kind = "text";
          data = await readAsText(file);
        } else {
          toast.error(`${file.name}: ${lang === "th" ? "ชนิดไฟล์ไม่รองรับ" : "unsupported type"}`);
          continue;
        }
        next.push({ name: file.name, kind, data, mime, size: file.size });
      } catch {
        toast.error(`${file.name}: ${lang === "th" ? "อ่านไฟล์ไม่สำเร็จ" : "read failed"}`);
      }
    }
    setAttachments(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (i: number) => setAttachments(attachments.filter((_, idx) => idx !== i));

  const onRun = async () => {
    if (!prompt.trim() && attachments.length === 0) return;
    setLoading(true);
    setOutput("");
    try {
      const res = await run({
        data: {
          prompt: prompt.trim() || (lang === "th" ? "ช่วยวิเคราะห์/สรุปไฟล์แนบ" : "Please analyze the attached files"),
          attachments: attachments.map(({ name, kind, data, mime }) => ({ name, kind, data, mime })),
        },
      });
      setOutput(res.output);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
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
                <span className="text-muted-foreground">· {fmtSize(a.size)}</span>
                <button onClick={() => removeAttachment(i)} className="ml-1 text-muted-foreground hover:text-foreground" aria-label="remove">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
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

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={loading}>
              <Paperclip className="mr-1.5 h-3.5 w-3.5" />
              {lang === "th" ? "แนบไฟล์" : "Attach"}
            </Button>
            <p className="hidden text-xs text-muted-foreground sm:block">
              {lang === "th" ? "รูปภาพ · PDF · ข้อความ (≤10MB/ไฟล์)" : "Images · PDF · text (≤10MB each)"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <VoiceInputButton onTranscript={onVoice} />
            <Button onClick={onRun} disabled={loading || (!prompt.trim() && attachments.length === 0)}>
              {loading ? t("running") : t("run")}
            </Button>
          </div>
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
