import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { adminUsageStats, adminMonthlyReport } from "@/lib/ai.functions";
import { buildMonthlyCsv, buildMonthlyPdf, downloadBlob, reportFilename, formatReportDate, formatPeriod, type MonthlyReport, type ReportLocale, type DateFormat } from "@/lib/admin-report";
import { processImageForPdf } from "@/lib/image-processing";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { BarChart3, Coins, Activity, Users, AlertTriangle, FileDown, FileText, Loader2, Eye } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/admin/usage")({
  head: () => ({ meta: [{ title: "การใช้งาน · RathCoWork Admin" }] }),
  component: AdminUsagePage,
});

function fmtCost(n: number) {
  return `$${n.toFixed(4)}`;
}
function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function AdminUsagePage() {
  const { lang } = useI18n();
  const fetchStats = useServerFn(adminUsageStats);
  const fetchMonthly = useServerFn(adminMonthlyReport);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-usage"],
    queryFn: () => fetchStats(),
  });

  const L = (th: string, en: string) => (lang === "th" ? th : en);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [loadingReport, setLoadingReport] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null);
  const [preview, setPreview] = useState<MonthlyReport | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerPosition, setSignerPosition] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [stampDataUrl, setStampDataUrl] = useState<string | null>(null);
  // Image processing controls
  const [sigScale, setSigScale] = useState(1.5);
  const [sigSharp, setSigSharp] = useState(0.3);
  const [sigTrim, setSigTrim] = useState(true);
  const [stampScale, setStampScale] = useState(1.5);
  const [stampSharp, setStampSharp] = useState(0.3);
  const [stampTrim, setStampTrim] = useState(true);
  // Locale / date format for header & footer
  const [reportLocale, setReportLocale] = useState<ReportLocale>("th");
  const [dateFormat, setDateFormat] = useState<DateFormat>("th-long");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("rathcowork.report.signer");
      if (raw) {
        const p = JSON.parse(raw) as {
          name?: string; position?: string; signature?: string; stamp?: string;
          sigScale?: number; sigSharp?: number; sigTrim?: boolean;
          stampScale?: number; stampSharp?: number; stampTrim?: boolean;
          locale?: ReportLocale; dateFormat?: DateFormat;
        };
        setSignerName(p.name ?? "");
        setSignerPosition(p.position ?? "");
        if (p.signature) setSignatureDataUrl(p.signature);
        if (p.stamp) setStampDataUrl(p.stamp);
        if (typeof p.sigScale === "number") setSigScale(p.sigScale);
        if (typeof p.sigSharp === "number") setSigSharp(p.sigSharp);
        if (typeof p.sigTrim === "boolean") setSigTrim(p.sigTrim);
        if (typeof p.stampScale === "number") setStampScale(p.stampScale);
        if (typeof p.stampSharp === "number") setStampSharp(p.stampSharp);
        if (typeof p.stampTrim === "boolean") setStampTrim(p.stampTrim);
        if (p.locale === "en" || p.locale === "th") setReportLocale(p.locale);
        if (p.dateFormat) setDateFormat(p.dateFormat);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      const payload: Record<string, unknown> = {
        name: signerName, position: signerPosition,
        sigScale, sigSharp, sigTrim,
        stampScale, stampSharp, stampTrim,
        locale: reportLocale, dateFormat,
      };
      if (signatureDataUrl && signatureDataUrl.length < 250_000) payload.signature = signatureDataUrl;
      if (stampDataUrl && stampDataUrl.length < 250_000) payload.stamp = stampDataUrl;
      localStorage.setItem("rathcowork.report.signer", JSON.stringify(payload));
    } catch { /* quota exceeded — ignore */ }
  }, [signerName, signerPosition, signatureDataUrl, stampDataUrl, sigScale, sigSharp, sigTrim, stampScale, stampSharp, stampTrim, reportLocale, dateFormat]);

  // Live preview of processed images (debounced via effect)
  const [processedSig, setProcessedSig] = useState<string | null>(null);
  const [processedStamp, setProcessedStamp] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!signatureDataUrl) { setProcessedSig(null); return; }
    processImageForPdf(signatureDataUrl, { scale: sigScale, sharpness: sigSharp, autoTrim: sigTrim })
      .then((u) => { if (!cancelled) setProcessedSig(u); })
      .catch(() => { if (!cancelled) setProcessedSig(signatureDataUrl); });
    return () => { cancelled = true; };
  }, [signatureDataUrl, sigScale, sigSharp, sigTrim]);
  useEffect(() => {
    let cancelled = false;
    if (!stampDataUrl) { setProcessedStamp(null); return; }
    processImageForPdf(stampDataUrl, { scale: stampScale, sharpness: stampSharp, autoTrim: stampTrim })
      .then((u) => { if (!cancelled) setProcessedStamp(u); })
      .catch(() => { if (!cancelled) setProcessedStamp(stampDataUrl); });
    return () => { cancelled = true; };
  }, [stampDataUrl, stampScale, stampSharp, stampTrim]);

  async function readImage(file: File): Promise<string> {
    if (!/^image\/(png|jpe?g)$/.test(file.type)) {
      throw new Error(L("รองรับเฉพาะ PNG/JPG", "Only PNG/JPG allowed"));
    }
    if (file.size > 2_000_000) {
      throw new Error(L("ขนาดเกิน 2MB", "File exceeds 2MB"));
    }
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error("read error"));
      fr.readAsDataURL(file);
    });
  }

  async function onPickImage(kind: "signature" | "stamp", file: File | undefined) {
    if (!file) return;
    try {
      const url = await readImage(file);
      if (kind === "signature") setSignatureDataUrl(url);
      else setStampDataUrl(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  }

  async function loadPreview() {
    setLoadingReport(true);
    try {
      const report = await fetchMonthly({ data: { year, month } });
      setPreview(report);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load report");
    } finally {
      setLoadingReport(false);
    }
  }

  async function handleExport(kind: "pdf" | "csv") {
    if (!preview) return;
    setExporting(kind);
    try {
      const signer = (signerName || signerPosition)
        ? { name: signerName.trim(), position: signerPosition.trim() }
        : null;
      if (kind === "csv") {
        downloadBlob(reportFilename(preview, "csv"), "text/csv;charset=utf-8", buildMonthlyCsv(preview));
      } else {
        const blob = await buildMonthlyPdf(preview, {
          signer,
          signatureDataUrl: processedSig ?? signatureDataUrl,
          stampDataUrl: processedStamp ?? stampDataUrl,
          locale: reportLocale,
          dateFormat,
        });
        downloadBlob(reportFilename(preview, "pdf"), "application/pdf", blob);
      }
      toast.success(L("ดาวน์โหลดสำเร็จ", "Download started"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }




  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : "Forbidden"}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <BarChart3 className="h-5 w-5 text-primary" />
            {L("การใช้งาน AI (30 วันล่าสุด)", "AI Usage (last 30 days)")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {L("สรุปจำนวนงาน โทเค็น และต้นทุนของทั้งระบบ", "System-wide runs, tokens, and cost")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
          <span className="px-2 text-xs text-muted-foreground">{L("รายงานเดือน", "Monthly report")}</span>
          <select
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
            ))}
          </select>
          <select
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <Button size="sm" disabled={loadingReport} onClick={loadPreview}>
            {loadingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            <span className="ml-1">{L("พรีวิวรายงาน", "Preview report")}</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard icon={Activity} label={L("งานทั้งหมด", "Total runs")} value={data.totals.runs.toLocaleString()} />
            <StatCard icon={BarChart3} label={L("โทเค็น (input)", "Prompt tokens")} value={fmtTokens(data.totals.promptTokens)} />
            <StatCard icon={BarChart3} label={L("โทเค็น (output)", "Completion tokens")} value={fmtTokens(data.totals.completionTokens)} />
            <StatCard icon={Coins} label={L("ต้นทุนรวม", "Total cost")} value={fmtCost(data.totals.costUsd)} />
            <StatCard
              icon={AlertTriangle}
              label={L("อัตรา fail", "Fail rate")}
              value={`${(data.totals.failRate * 100).toFixed(1)}% (${data.totals.fails})`}
            />
          </div>

          <section className="mt-8 rounded-lg border border-border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              {L("ต้นทุนรายวัน", "Daily cost")}
            </h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      fontSize: 12,
                      color: "var(--foreground)",
                    }}
                    formatter={(v: number, name: string) => [name === "cost" ? fmtCost(v) : v, name]}
                  />
                  <Line type="monotone" dataKey="cost" stroke="var(--primary)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="runs" stroke="var(--muted-foreground)" strokeWidth={1} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Users className="h-4 w-4" />{L("ผู้ใช้ใช้งานสูงสุด", "Top users by cost")}
              </h2>
              <Table
                head={[L("ผู้ใช้", "User"), L("งาน", "Runs"), L("โทเค็น", "Tokens"), L("ต้นทุน", "Cost")]}
                rows={data.topUsers.map((u) => [u.name, u.runs.toString(), fmtTokens(u.tokens), fmtCost(u.cost)])}
              />
            </section>
            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                {L("เทมเพลตยอดนิยม", "Top templates")}
              </h2>
              <Table
                head={[L("เทมเพลต", "Template"), L("งาน", "Runs"), L("เฉลี่ย tok", "Avg tok"), L("ต้นทุน", "Cost"), L("fail %", "Fail %")]}
                rows={data.topTemplates.map((t) => [
                  t.id,
                  t.runs.toString(),
                  fmtTokens(t.avgTokens),
                  fmtCost(t.cost),
                  `${(t.failRate * 100).toFixed(1)}%`,
                ])}
              />
            </section>
          </div>

          {data.worstTemplates.length > 0 && (
            <section className="mt-6 rounded-lg border border-amber-500/40 bg-amber-500/5 p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                {L("เทมเพลตที่ fail บ่อย", "Templates with most failures")}
              </h2>
              <Table
                head={[L("เทมเพลต", "Template"), L("fail", "Fails"), L("งาน", "Runs"), L("fail %", "Fail %")]}
                rows={data.worstTemplates.map((t) => [
                  t.id,
                  t.fails.toString(),
                  t.runs.toString(),
                  `${(t.failRate * 100).toFixed(1)}%`,
                ])}
              />
            </section>
          )}
        </>
      ) : null}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {L("พรีวิวรายงานรายเดือน", "Monthly report preview")}
              {preview && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {String(preview.period.month).padStart(2, "0")}/{preview.period.year}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-5">
              <div className="grid gap-2 sm:grid-cols-4">
                <MiniKpi label={L("งาน", "Runs")} value={preview.totals.runs.toLocaleString()} />
                <MiniKpi label={L("ต้นทุน", "Cost")} value={fmtCost(preview.totals.costUsd)} />
                <MiniKpi label={L("โทเค็นรวม", "Tokens")} value={fmtTokens(preview.totals.totalTokens)} />
                <MiniKpi label={L("Fail %", "Fail %")} value={`${(preview.totals.failRate * 100).toFixed(1)}%`} />
                <MiniKpi label={L("Input tok", "Input tok")} value={fmtTokens(preview.totals.promptTokens)} />
                <MiniKpi label={L("Output tok", "Output tok")} value={fmtTokens(preview.totals.completionTokens)} />
                <MiniKpi label={L("ผู้ใช้", "Users")} value={preview.totals.uniqueUsers.toLocaleString()} />
                <MiniKpi label={L("เทมเพลต", "Templates")} value={preview.totals.uniqueTemplates.toLocaleString()} />
              </div>

              <section className="rounded-lg border border-border bg-card p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {L("ต้นทุน/งาน รายวัน", "Daily cost & runs")}
                </h3>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={preview.daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)", border: "1px solid var(--border)",
                          borderRadius: 6, fontSize: 12, color: "var(--foreground)",
                        }}
                      />
                      <Line type="monotone" dataKey="cost" stroke="var(--primary)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="runs" stroke="var(--muted-foreground)" strokeWidth={1} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-lg border border-border bg-card p-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {L("Top 5 ผู้ใช้", "Top 5 users")}
                  </h3>
                  <Table
                    head={[L("ชื่อ", "Name"), L("งาน", "Runs"), L("ต้นทุน", "Cost")]}
                    rows={preview.users.slice(0, 5).map((u) => [u.name, u.runs.toString(), fmtCost(u.cost)])}
                  />
                </section>
                <section className="rounded-lg border border-border bg-card p-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {L("Top 5 เทมเพลต", "Top 5 templates")}
                  </h3>
                  <Table
                    head={[L("Template", "Template"), L("งาน", "Runs"), L("ต้นทุน", "Cost")]}
                    rows={preview.templates.slice(0, 5).map((t) => [t.id, t.runs.toString(), fmtCost(t.cost)])}
                  />
                </section>
              </div>

              <section className="rounded-lg border border-border bg-card p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {L("ผู้ลงนาม (จะแสดงในหัวกระดาษ/ฟุตเตอร์ของ PDF)", "Signer (shown in PDF header/footer)")}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">{L("ชื่อ", "Name")}</label>
                    <Input
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder={L("เช่น นายสมชาย ใจดี", "e.g. Jane Smith")}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">{L("ตำแหน่ง", "Position")}</label>
                    <Input
                      value={signerPosition}
                      onChange={(e) => setSignerPosition(e.target.value)}
                      placeholder={L("เช่น ผู้อำนวยการสำนัก", "e.g. CTO")}
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <ImageUploadField
                    label={L("รูปลายเซ็น (ฟุตเตอร์, PNG/JPG ≤2MB)", "Signature image (footer, PNG/JPG ≤2MB)")}
                    value={signatureDataUrl}
                    onPick={(f) => onPickImage("signature", f)}
                    onClear={() => setSignatureDataUrl(null)}
                  />
                  <ImageUploadField
                    label={L("ตราประทับ (หัวกระดาษ, PNG/JPG ≤2MB)", "Stamp (header, PNG/JPG ≤2MB)")}
                    value={stampDataUrl}
                    onPick={(f) => onPickImage("stamp", f)}
                    onClear={() => setStampDataUrl(null)}
                  />
                </div>

                <div className="mt-4 rounded-md border border-dashed border-border bg-background p-3 text-xs">
                  <p className="mb-2 font-medium text-muted-foreground">{L("ตัวอย่างที่จะอยู่ใน PDF", "PDF preview")}</p>
                  <div className="flex items-start justify-between gap-3 border-b border-border pb-2 text-[11px] text-muted-foreground">
                    <span>RathCoWork · รายงานการใช้งานรายเดือน</span>
                    <div className="flex items-start gap-2">
                      <div className="text-right">
                        <div>{String(preview.period.month).padStart(2, "0")}/{preview.period.year}</div>
                        {(signerName || signerPosition) && (
                          <div className="text-[10px]">
                            ผู้รับผิดชอบ: {signerName}{signerPosition ? ` · ${signerPosition}` : ""}
                          </div>
                        )}
                      </div>
                      {stampDataUrl && (
                        <img src={stampDataUrl} alt="stamp" className="h-10 w-auto object-contain" />
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3 border-t border-border pt-2 text-[10px] text-muted-foreground">
                    <div>
                      <div>สร้างเมื่อ {new Date().toLocaleString("th-TH")}</div>
                      {(signerName || signerPosition) && (
                        <div>ลงนาม: {signerName}{signerPosition ? ` (${signerPosition})` : ""}</div>
                      )}
                    </div>
                    {signatureDataUrl && (
                      <img src={signatureDataUrl} alt="signature" className="h-10 w-auto object-contain" />
                    )}
                    <div>หน้า 1 / N</div>
                  </div>
                </div>
              </section>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" disabled={!!exporting} onClick={() => handleExport("csv")}>
              {exporting === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              <span className="ml-1.5">CSV</span>
            </Button>
            <Button disabled={!!exporting} onClick={() => handleExport("pdf")}>
              {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              <span className="ml-1.5">PDF</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-xs text-muted-foreground">—</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
        <tr>{head.map((h, i) => <th key={i} className="px-2 py-2 text-left font-medium">{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-border last:border-0">
            {r.map((c, j) => (
              <td key={j} className={`px-2 py-2 ${j === 0 ? "text-foreground" : "text-muted-foreground font-mono text-xs"}`}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ImageUploadField({
  label,
  value,
  onPick,
  onClear,
}: {
  label: string;
  value: string | null;
  onPick: (file: File | undefined) => void;
  onClear: () => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <div className="flex items-center gap-3 rounded-md border border-border bg-background p-2">
        <div className="flex h-14 w-24 items-center justify-center overflow-hidden rounded border border-dashed border-border bg-muted/30">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] text-muted-foreground">—</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => onPick(e.target.files?.[0])}
            className="text-xs file:mr-2 file:rounded-md file:border file:border-border file:bg-background file:px-2 file:py-1 file:text-xs file:text-foreground hover:file:bg-muted"
          />
          {value && (
            <button
              type="button"
              onClick={onClear}
              className="self-start text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            >
              ลบรูป
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
