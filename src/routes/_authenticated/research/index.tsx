import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runDeepResearch, type ResearchSource } from "@/lib/research.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Telescope, Copy, ExternalLink, FileText, Paperclip, X, Image as ImageIcon, FileType2, Link as LinkIcon } from "lucide-react";
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

const MAX_FILES = 6;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|yaml|yml|log|html?)$/i;

const readAsDataUrl = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
const readAsText = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(f); });

function ResearchPage() {
  const { lang } = useI18n();
  const research = useServerFn(runDeepResearch);
  const [question, setQuestion] = useState("");
  const [urlsText, setUrlsText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [limit, setLimit] = useState(6);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState("");
  const [sources, setSources] = useState<ResearchSource[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsedUrls = urlsText.split(/\s+/).map((s) => s.trim()).filter((s) => /^https?:\/\//i.test(s));
  const hasProvided = parsedUrls.length > 0 || attachments.length > 0;

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
    setLoading(true); setReport(""); setSources([]);
    try {
      const r = await research({
        data: {
          question: question.trim(),
          limit,
          lang,
          urls: parsedUrls,
          attachments: attachments.map((a) => ({ name: a.name, kind: a.kind, data: a.data, mime: a.mime, size: a.size })),
        },
      });
      setReport(r.report);
      setSources(r.sources);
      const tail = attachments.length > 0 ? ` + ${attachments.length} ${lang === "th" ? "ไฟล์" : "files"}` : "";
      toast.success(lang === "th" ? `รวบรวมจาก ${r.sources.length} แหล่ง${tail}` : `Synthesized from ${r.sources.length} sources${tail}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `research-${Date.now()}.md`; a.click();
    URL.revokeObjectURL(url);
  };

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
            <Button variant="ghost" size="sm" type="button" onClick={() => fileRef.current?.click()} disabled={attachments.length >= MAX_FILES}>
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
                  <button onClick={() => removeAtt(i)} aria-label="remove" className="text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <label className={`flex items-center gap-2 text-xs ${hasProvided ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
            {lang === "th" ? "จำนวนแหล่งสูงสุด (โหมดค้นเว็บ)" : "Max web sources"}
            <input
              type="number"
              min={3}
              max={10}
              value={limit}
              disabled={hasProvided}
              onChange={(e) => setLimit(Math.max(3, Math.min(10, Number(e.target.value) || 6)))}
              className="h-7 w-16 rounded-md border border-border bg-background px-2 text-xs disabled:opacity-50"
            />
          </label>
          <Button onClick={onRun} disabled={loading || question.trim().length < 5}>
            {loading
              ? (lang === "th" ? "กำลังวิจัย…" : "Researching…")
              : hasProvided
                ? (lang === "th" ? "วิจัยจากแหล่งที่ระบุ" : "Research from sources")
                : (lang === "th" ? "ค้นเว็บและวิจัย" : "Search & research")}
          </Button>
        </div>
      </div>

      {sources.length > 0 && (
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
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{lang === "th" ? "รายงาน" : "Report"}</h2>
            <div className="flex items-center gap-1">
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
