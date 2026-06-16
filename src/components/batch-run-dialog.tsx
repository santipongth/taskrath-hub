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
import { Layers, Upload, Download, FileSpreadsheet, X } from "lucide-react";
import { toast } from "sonner";
import { runTemplate } from "@/lib/ai.functions";
import type { TemplateField } from "@/lib/templates";
import { parseCSV, toCSV, downloadCSV } from "@/lib/csv";

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
  const cancelRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const ready = rows.length > 0 && fields.every((f) => !f.required || (mapping[f.name] && mapping[f.name] !== SKIP));

  const onFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error("ไฟล์ต้องไม่เกิน 5MB"); return; }
    const text = await file.text();
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
    // auto-map by name match
    const initial: Record<string, string> = {};
    for (const f of fields) {
      const match = hdrs.find((h) => h === f.name || h.toLowerCase() === f.name.toLowerCase() || h === f.labelTh || h === f.labelEn);
      initial[f.name] = match ?? SKIP;
    }
    setMapping(initial);
    setResults([]);
    setProgress(0);
    toast.success(`โหลด ${data.length} แถว`);
  };

  const downloadTemplate = () => {
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

  const reset = () => {
    setHeaders([]); setRows([]); setMapping({}); setResults([]); setProgress(0);
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
            <Button variant="ghost" size="sm" className="w-full" onClick={downloadTemplate}>
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
              ดาวน์โหลด CSV ตัวอย่าง
            </Button>
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
