import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runDeepResearch, type ResearchSource } from "@/lib/research.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Telescope, Copy, ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/research/")({
  head: () => ({ meta: [{ title: "Deep Research · RathCoWork" }] }),
  component: ResearchPage,
});

function ResearchPage() {
  const { lang } = useI18n();
  const research = useServerFn(runDeepResearch);
  const [question, setQuestion] = useState("");
  const [limit, setLimit] = useState(6);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState("");
  const [sources, setSources] = useState<ResearchSource[]>([]);

  const onRun = async () => {
    if (question.trim().length < 5) {
      toast.error(lang === "th" ? "พิมพ์คำถามอย่างน้อย 5 ตัวอักษร" : "Question too short");
      return;
    }
    setLoading(true); setReport(""); setSources([]);
    try {
      const r = await research({ data: { question: question.trim(), limit, lang } });
      setReport(r.report);
      setSources(r.sources);
      toast.success(lang === "th" ? `รวบรวมจาก ${r.sources.length} แหล่ง` : `Synthesized from ${r.sources.length} sources`);
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
            ? "ค้นเว็บ อ่านแหล่งที่เกี่ยวข้อง แล้วสรุปเป็นรายงานพร้อมการอ้างอิง [n]"
            : "Search the web, read sources, and synthesize a cited report"}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={lang === "th" ? "เช่น สรุปสาระสำคัญของ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 และผลกระทบต่อหน่วยงานราชการ" : "e.g. Summarize the Thai PDPA and its impact on government agencies"}
          rows={4}
          className="resize-none border-border shadow-none focus-visible:ring-1"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {lang === "th" ? "จำนวนแหล่งสูงสุด" : "Max sources"}
            <input
              type="number"
              min={3}
              max={10}
              value={limit}
              onChange={(e) => setLimit(Math.max(3, Math.min(10, Number(e.target.value) || 6)))}
              className="h-7 w-16 rounded-md border border-border bg-background px-2 text-xs"
            />
          </label>
          <Button onClick={onRun} disabled={loading || question.trim().length < 5}>
            {loading ? (lang === "th" ? "กำลังวิจัย…" : "Researching…") : (lang === "th" ? "เริ่มวิจัย" : "Research")}
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
