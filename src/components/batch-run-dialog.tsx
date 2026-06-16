import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Layers, Upload, Download, FileSpreadsheet, X, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { runTemplate } from "@/lib/ai.functions";
import type { TemplateField } from "@/lib/templates";
import { parseCSV, toCSV, downloadCSV } from "@/lib/csv";
import { SAMPLES_BY_TEMPLATE, BATCH_SAMPLES } from "@/lib/batch-samples";
import { Sparkles } from "lucide-react";

type Row = Record<string, string>;
type Result = { row: Row; ok: boolean; output?: string; error?: string };

const SKIP = "__skip__";

export function BatchRunDialog({
  templateId,
  templateTitle,
  fields,
}: {
  templateId: string;
  templateTitle: string;
  fields: TemplateField[];
}) {
  const run = useServerFn(runTemplate);
  const [open, setOpen] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({}); // field.name -> csv header
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [preview, setPreview] = useState<{ loading: boolean; output?: string; error?: string } | null>(null);
  const cancelRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const ready = rows.length > 0 && fields.every((f) => !f.required || (mapping[f.name] && mapping[f.name] !== SKIP));
  const matchedSample = SAMPLES_BY_TEMPLATE[templateId];
  // Show 2 cross-template samples as fallback inspiration when no exact match
  const otherSamples = BATCH_SAMPLES.filter((s) => s.templateId !== templateId).slice(0, 3);

  const loadFromText = (text: string, sourceLabel: string) => {
    const parsed = parseCSV(text);
    if (parsed.length < 2) { toast.error("CSV ต้องมีหัวคอลัมน์และอย่างน้อย 1 แถว"); return; }
    const hdrs = parsed[0].map((h) => h.trim());
    const data = parsed.slice(1).map((r) => {
      const o: Row = {};
      hdrs.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
      return o;
    }).filter((r) => Object.values(r).some((v) => v));
    setHeaders(hdrs);
    setRows(data);
    const initial: Record<string, string> = {};
    for (const f of fields) {
      const match = hdrs.find((h) => h === f.name || h.toLowerCase() === f.name.toLowerCase() || h === f.labelTh || h === f.labelEn);
      initial[f.name] = match ?? SKIP;
    }
    setMapping(initial);
    setResults([]);
    setProgress(0);
    toast.success(`${sourceLabel}: โหลด ${data.length} แถว`);
  };

  const onFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error("ไฟล์ต้องไม่เกิน 5MB"); return; }
    const text = await file.text();
    loadFromText(text, file.name);
  };

  const loadSample = (sample: typeof BATCH_SAMPLES[number]) => {
    loadFromText(toCSV(sample.rows), sample.titleTh);
  };

  const downloadTemplate = () => {
    if (matchedSample) {
      downloadCSV(`${templateId}-sample.csv`, toCSV(matchedSample.rows));
      return;
    }
    const hdrs = fields.map((f) => f.name);
    const sample = fields.map((f) => f.placeholderTh ?? "");
    downloadCSV(`${templateId}-template.csv`, toCSV([hdrs, sample]));
  };

  const start = async () => {
    setRunning(true);
    cancelRef.current = false;
    setResults([]);
    setProgress(0);
    const out: Result[] = [];
    for (let i = 0; i < rows.length; i++) {
      if (cancelRef.current) break;
      const row = rows[i];
      const inputs: Record<string, string> = {};
      for (const f of fields) {
        const h = mapping[f.name];
        if (h && h !== SKIP) inputs[f.name] = row[h] ?? "";
      }
      try {
        const res = await run({ data: { templateId, inputs, title: `Batch ${i + 1}/${rows.length}` } });
        out.push({ row, ok: true, output: res.output });
      } catch (e) {
        out.push({ row, ok: false, error: e instanceof Error ? e.message : "error" });
      }
      setResults([...out]);
      setProgress(Math.round(((i + 1) / rows.length) * 100));
    }
    setRunning(false);
    if (!cancelRef.current) toast.success(`เสร็จสิ้น ${out.filter((r) => r.ok).length}/${rows.length} แถว`);
  };

  const exportResults = () => {
    if (results.length === 0) return;
    const outHdrs = [...headers, "__status__", "__output__", "__error__"];
    const data = results.map((r) => [
      ...headers.map((h) => r.row[h] ?? ""),
      r.ok ? "OK" : "ERROR",
      r.output ?? "",
      r.error ?? "",
    ]);
    downloadCSV(`${templateId}-batch-results.csv`, toCSV([outHdrs, ...data]));
  };

  const runPreview = async () => {
    if (rows.length === 0) return;
    setPreview({ loading: true });
    const row = rows[0];
    const inputs: Record<string, string> = {};
    for (const f of fields) {
      const h = mapping[f.name];
      if (h && h !== SKIP) inputs[f.name] = row[h] ?? "";
    }
    try {
      const res = await run({ data: { templateId, inputs, title: "Batch preview (แถวที่ 1)" } });
      setPreview({ loading: false, output: res.output });
    } catch (e) {
      setPreview({ loading: false, error: e instanceof Error ? e.message : "error" });
    }
  };

  const reset = () => {
    setHeaders([]); setRows([]); setMapping({}); setResults([]); setProgress(0); setPreview(null);
  };

  const okCount = useMemo(() => results.filter((r) => r.ok).length, [results]);
  const errCount = results.length - okCount;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o && !running) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Layers className="mr-1.5 h-3.5 w-3.5" />
          รันชุด (CSV)
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>รันเทมเพลตเป็นชุด — {templateTitle}</DialogTitle>
          <DialogDescription>
            อัปโหลด CSV (UTF-8) ระบบจะรันทีละแถวและรวมผลให้ดาวน์โหลดเป็น CSV
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <div className="space-y-3">
            <div
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-muted/30 px-6 py-10 text-center hover:bg-muted/50"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">คลิกเพื่อเลือกไฟล์ CSV</p>
              <p className="text-[11px] text-muted-foreground">UTF-8 · ขนาดไม่เกิน 5MB · แถวแรกเป็นชื่อคอลัมน์</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
            />
            <div className="rounded-md border border-border bg-card p-3">
              <p className="mb-2 text-xs font-medium">คอลัมน์ที่เทมเพลตต้องการ</p>
              <ul className="space-y-1 text-[11px] text-muted-foreground">
                {fields.map((f) => (
                  <li key={f.name} className="flex flex-wrap items-baseline gap-x-2">
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-foreground">{f.name}</code>
                    <span className="text-foreground">{f.labelTh}</span>
                    {f.required && <Badge variant="outline" className="h-4 px-1 text-[9px]">จำเป็น</Badge>}
                    {f.placeholderTh && <span className="text-muted-foreground">— {f.placeholderTh}</span>}
                  </li>
                ))}
              </ul>
            </div>

            <Button variant="outline" size="sm" className="w-full" onClick={downloadTemplate}>
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
              ดาวน์โหลด CSV ตัวอย่างของเทมเพลตนี้
            </Button>

            {matchedSample && (
              <Button variant="secondary" size="sm" className="w-full" onClick={() => loadSample(matchedSample)}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                โหลดตัวอย่างสำเร็จรูป — {matchedSample.titleTh}
              </Button>
            )}

            {!matchedSample && otherSamples.length > 0 && (
              <div className="rounded-md border border-dashed border-border bg-muted/20 p-3">
                <p className="mb-2 text-[11px] font-medium text-muted-foreground">หรือดูตัวอย่างจากเทมเพลตอื่น (โครงสร้าง CSV เป็นแนวทาง)</p>
                <div className="space-y-1">
                  {otherSamples.map((s) => (
                    <button
                      key={s.templateId}
                      onClick={() => loadSample(s)}
                      className="block w-full rounded px-2 py-1 text-left text-[11px] hover:bg-muted"
                    >
                      <span className="font-medium text-foreground">{s.titleTh}</span>
                      <span className="ml-1 text-muted-foreground">— {s.descTh}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">โหลดแล้ว <strong className="text-foreground">{rows.length}</strong> แถว · {headers.length} คอลัมน์</span>
              {!running && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={reset}>
                  <X className="mr-1 h-3 w-3" />ล้าง
                </Button>
              )}
            </div>

            <div className="space-y-2 rounded-md border border-border bg-card p-3">
              <p className="text-xs font-medium">จับคู่คอลัมน์ CSV → ช่องของเทมเพลต</p>
              <div className="grid gap-2">
                {fields.map((f) => (
                  <div key={f.name} className="grid grid-cols-2 items-center gap-2">
                    <Label className="truncate text-xs">
                      {f.labelTh}
                      {f.required && <span className="ml-1 text-destructive">*</span>}
                    </Label>
                    <Select
                      value={mapping[f.name] ?? SKIP}
                      onValueChange={(v) => setMapping((p) => ({ ...p, [f.name]: v }))}
                      disabled={running}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SKIP}>— ไม่ใช้ —</SelectItem>
                        {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {ready && !running && results.length === 0 && (
              <div className="space-y-2 rounded-md border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium inline-flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" /> ตัวอย่างผลลัพธ์ (แถวที่ 1)
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={runPreview}
                    disabled={preview?.loading}
                  >
                    {preview?.loading ? (
                      <><Loader2 className="mr-1 h-3 w-3 animate-spin" />กำลังรัน...</>
                    ) : (
                      <>{preview ? "รันใหม่" : "ลองรัน 1 แถว"}</>
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  ทดลองรันด้วยข้อมูลแถวแรกก่อน เพื่อตรวจสอบผลลัพธ์ก่อนรันทั้งชุด ({rows.length} แถว)
                </p>
                {preview?.output && (
                  <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded border border-border bg-muted/30 p-2 text-[11px] text-foreground">
                    {preview.output}
                  </pre>
                )}
                {preview?.error && (
                  <p className="rounded border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
                    {preview.error}
                  </p>
                )}
              </div>
            )}

            {(running || results.length > 0) && (
              <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span>ความคืบหน้า {results.length}/{rows.length}</span>
                  <div className="flex gap-2">
                    {okCount > 0 && <Badge variant="secondary" className="text-[10px]">สำเร็จ {okCount}</Badge>}
                    {errCount > 0 && <Badge variant="destructive" className="text-[10px]">ล้มเหลว {errCount}</Badge>}
                  </div>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {results.length > 0 && (
            <Button variant="outline" onClick={exportResults} disabled={running}>
              <Download className="mr-1.5 h-4 w-4" />
              ดาวน์โหลดผล CSV
            </Button>
          )}
          {running ? (
            <Button variant="destructive" onClick={() => { cancelRef.current = true; }}>หยุด</Button>
          ) : rows.length > 0 ? (
            <Button onClick={start} disabled={!ready}>
              เริ่มรัน {rows.length} แถว
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
