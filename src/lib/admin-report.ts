import { jsPDF } from "jspdf";
import { ensureSarabun } from "@/lib/pdf-fonts";

export type MonthlyReport = {
  period: { year: number; month: number; start: string; end: string };
  totals: {
    runs: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
    fails: number;
    failRate: number;
    uniqueUsers: number;
    uniqueTemplates: number;
  };
  daily: { day: string; tokens: number; cost: number; runs: number; fails: number }[];
  users: { id: string; name: string; runs: number; tokens: number; cost: number; fails: number }[];
  templates: { id: string; runs: number; tokens: number; cost: number; fails: number; avgTokens: number; failRate: number }[];
};

const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const fmtCost = (n: number) => `$${n.toFixed(4)}`;
const fmtInt = (n: number) => n.toLocaleString();

function csvEscape(v: string | number): string {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildMonthlyCsv(r: MonthlyReport): string {
  const lines: string[] = [];
  const periodLabel = `${TH_MONTHS[r.period.month - 1]} ${r.period.year + 543}`;
  lines.push(`RathCoWork - รายงานการใช้งานรายเดือน,${csvEscape(periodLabel)}`);
  lines.push("");
  lines.push("KPI,ค่า");
  lines.push(`งานทั้งหมด,${r.totals.runs}`);
  lines.push(`โทเค็น (input),${r.totals.promptTokens}`);
  lines.push(`โทเค็น (output),${r.totals.completionTokens}`);
  lines.push(`โทเค็นรวม,${r.totals.totalTokens}`);
  lines.push(`ต้นทุนรวม (USD),${r.totals.costUsd.toFixed(6)}`);
  lines.push(`อัตรา fail,${(r.totals.failRate * 100).toFixed(2)}%`);
  lines.push(`จำนวน fail,${r.totals.fails}`);
  lines.push(`ผู้ใช้ที่ใช้งาน,${r.totals.uniqueUsers}`);
  lines.push(`เทมเพลตที่ใช้,${r.totals.uniqueTemplates}`);
  lines.push("");
  lines.push("รายวัน");
  lines.push("วันที่,งาน,โทเค็น,ต้นทุน_USD,fails");
  for (const d of r.daily) lines.push(`${d.day},${d.runs},${d.tokens},${d.cost.toFixed(6)},${d.fails}`);
  lines.push("");
  lines.push("ผู้ใช้");
  lines.push("ชื่อ,user_id,งาน,โทเค็น,ต้นทุน_USD,fails");
  for (const u of r.users) lines.push([csvEscape(u.name), u.id, u.runs, u.tokens, u.cost.toFixed(6), u.fails].join(","));
  lines.push("");
  lines.push("เทมเพลต");
  lines.push("template_id,งาน,โทเค็น,เฉลี่ย_tokens,ต้นทุน_USD,fails,fail_rate");
  for (const t of r.templates) lines.push([csvEscape(t.id), t.runs, t.tokens, t.avgTokens, t.cost.toFixed(6), t.fails, (t.failRate * 100).toFixed(2) + "%"].join(","));
  return "\uFEFF" + lines.join("\n");
}

export function downloadBlob(filename: string, mime: string, body: BlobPart) {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type Signer = { name: string; position: string };
export type ReportLocale = "th" | "en";
export type DateFormat = "th-long" | "th-short" | "en-long" | "en-short" | "iso";
/** Either may be a `data:image/png|jpeg;base64,...` URL (any size; auto-fit in header/footer). */
export type BuildOptions = {
  signer?: Signer | null;
  signatureDataUrl?: string | null;
  stampDataUrl?: string | null;
  locale?: ReportLocale;
  dateFormat?: DateFormat;
};

function detectImgFmt(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg") ? "JPEG" : "PNG";
}

const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatReportDate(d: Date, fmt: DateFormat): string {
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  switch (fmt) {
    case "th-long":
      return `${day} ${TH_MONTHS[m]} ${y + 543} ${hh}:${mm}`;
    case "th-short":
      return `${String(day).padStart(2, "0")}/${String(m + 1).padStart(2, "0")}/${y + 543} ${hh}:${mm}`;
    case "en-long":
      return `${EN_MONTHS[m]} ${day}, ${y} ${hh}:${mm}`;
    case "en-short":
      return `${String(m + 1).padStart(2, "0")}/${String(day).padStart(2, "0")}/${y} ${hh}:${mm}`;
    case "iso":
      return `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")} ${hh}:${mm}`;
  }
}

export function formatPeriod(year: number, month: number, locale: ReportLocale): string {
  if (locale === "en") return `${EN_MONTHS[month - 1]} ${year}`;
  return `${TH_MONTHS[month - 1]} ${year + 543}`;
}

export async function buildMonthlyPdf(r: MonthlyReport, opts: BuildOptions = {}): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await ensureSarabun(doc);
  doc.setFont("Sarabun", "normal");

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const headerH = 40;
  const footerH = 36;
  const contentTop = margin + headerH;
  const contentBottom = pageH - margin - footerH;
  const contentW = pageW - margin * 2;
  let y = contentTop;
  const locale: ReportLocale = opts.locale ?? "th";
  const dateFormat: DateFormat = opts.dateFormat ?? (locale === "en" ? "en-long" : "th-long");
  const periodLabel = formatPeriod(r.period.year, r.period.month, locale);
  const generatedAt = formatReportDate(new Date(), dateFormat);
  const signer = opts.signer && (opts.signer.name || opts.signer.position) ? opts.signer : null;
  const T = (th: string, en: string) => (locale === "en" ? en : th);

  const ensureSpace = (need: number) => {
    if (y + need > contentBottom) { doc.addPage(); y = contentTop; }
  };

  doc.setFontSize(16);
  doc.text(T("RathCoWork — รายงานการใช้งานรายเดือน", "RathCoWork — Monthly Usage Report"), margin, y); y += 22;
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(`${T("รอบการใช้งาน", "Period")}: ${periodLabel}`, margin, y); y += 14;
  doc.text(`${T("สร้างเมื่อ", "Generated")}: ${generatedAt}`, margin, y); y += 18;
  doc.setTextColor(0);

  // KPI grid
  doc.setFontSize(12);
  doc.text(T("ภาพรวม (KPI)", "Overview (KPI)"), margin, y); y += 12;
  const kpis: [string, string][] = [
    ["งานทั้งหมด", fmtInt(r.totals.runs)],
    ["ต้นทุนรวม", fmtCost(r.totals.costUsd)],
    ["โทเค็นรวม", fmtInt(r.totals.totalTokens)],
    ["อัตรา fail", `${(r.totals.failRate * 100).toFixed(2)}% (${r.totals.fails})`],
    ["Input tokens", fmtInt(r.totals.promptTokens)],
    ["Output tokens", fmtInt(r.totals.completionTokens)],
    ["ผู้ใช้ที่ใช้งาน", fmtInt(r.totals.uniqueUsers)],
    ["เทมเพลตที่ใช้", fmtInt(r.totals.uniqueTemplates)],
  ];
  const cols = 4;
  const cellW = contentW / cols;
  const cellH = 42;
  for (let i = 0; i < kpis.length; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const cx = margin + col * cellW;
    const cy = y + row * cellH;
    doc.setDrawColor(220); doc.setFillColor(250, 250, 251);
    doc.roundedRect(cx + 2, cy + 2, cellW - 4, cellH - 4, 4, 4, "FD");
    doc.setTextColor(110); doc.setFontSize(8);
    doc.text(kpis[i][0], cx + 10, cy + 16);
    doc.setTextColor(20); doc.setFontSize(13);
    doc.text(kpis[i][1], cx + 10, cy + 32);
  }
  y += Math.ceil(kpis.length / cols) * cellH + 14;

  // Auto height: more days -> rotate x-labels -> need more bottom padding
  const chartH = r.daily.length > 18 ? 190 : 160;
  drawDailyChart(doc, r, margin, y, contentW, chartH);
  y += chartH + 14;

  const drawTable = (title: string, head: string[], rows: string[][], widths: number[]) => {
    ensureSpace(40);
    doc.setFontSize(12); doc.setTextColor(0);
    doc.text(title, margin, y); y += 12;
    doc.setFontSize(9);
    ensureSpace(18);
    doc.setFillColor(240, 240, 243);
    doc.rect(margin, y, contentW, 18, "F");
    let hx = margin + 6;
    doc.setTextColor(70);
    head.forEach((h, i) => { doc.text(h, hx, y + 12); hx += widths[i]; });
    y += 18;
    doc.setTextColor(20);
    rows.forEach((row, ri) => {
      const wrapped = row.map((cell, i) =>
        doc.splitTextToSize(String(cell), widths[i] - 8) as string[]);
      const lines = Math.max(...wrapped.map((w) => w.length));
      const rowH = 10 + lines * 11;
      ensureSpace(rowH);
      if (ri % 2 === 1) {
        doc.setFillColor(249, 249, 250);
        doc.rect(margin, y, contentW, rowH, "F");
      }
      let cx = margin + 6;
      wrapped.forEach((wl, i) => {
        doc.text(wl, cx, y + 12);
        cx += widths[i];
      });
      doc.setDrawColor(232);
      doc.line(margin, y + rowH, pageW - margin, y + rowH);
      y += rowH;
    });
    y += 10;
  };

  drawTable(
    "รายวัน",
    ["วันที่", "งาน", "โทเค็น", "ต้นทุน", "fails"],
    r.daily.map((d) => [d.day, fmtInt(d.runs), fmtInt(d.tokens), fmtCost(d.cost), String(d.fails)]),
    [110, 80, 110, 110, 105],
  );

  drawTable(
    "ผู้ใช้ (เรียงตามต้นทุน)",
    ["ชื่อ", "งาน", "โทเค็น", "ต้นทุน", "fails"],
    r.users.slice(0, 50).map((u) => [u.name, fmtInt(u.runs), fmtInt(u.tokens), fmtCost(u.cost), String(u.fails)]),
    [220, 60, 100, 100, 35],
  );

  drawTable(
    "เทมเพลต (เรียงตามจำนวนงาน)",
    ["Template", "งาน", "เฉลี่ย tok", "ต้นทุน", "fail %"],
    r.templates.slice(0, 50).map((t) => [t.id, fmtInt(t.runs), fmtInt(t.avgTokens), fmtCost(t.cost), `${(t.failRate * 100).toFixed(1)}%`]),
    [240, 60, 75, 90, 50],
  );

  // Header + footer on every page
  const totalPages = doc.getNumberOfPages();
  const stamp = opts.stampDataUrl || null;
  const signature = opts.signatureDataUrl || null;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("Sarabun", "normal");
    doc.setDrawColor(210);
    doc.setTextColor(95);
    doc.setFontSize(9);
    doc.text(T("RathCoWork · รายงานการใช้งานรายเดือน", "RathCoWork · Monthly Usage Report"), margin, margin + 12);

    // Stamp top-right (above the period label), preserves aspect ratio, capped
    let stampW = 0;
    if (stamp) {
      try {
        const props = doc.getImageProperties(stamp);
        const maxH = headerH - 12, maxW = 70;
        const ratio = props.width / props.height;
        let sh = maxH, sw = sh * ratio;
        if (sw > maxW) { sw = maxW; sh = sw / ratio; }
        doc.addImage(stamp, detectImgFmt(stamp), pageW - margin - sw, margin - 2, sw, sh);
        stampW = sw + 6;
      } catch { /* ignore bad image */ }
    }
    doc.text(periodLabel, pageW - margin - stampW - doc.getTextWidth(periodLabel), margin + 12);
    if (signer) {
      doc.setFontSize(8);
      const line = `${T("ผู้รับผิดชอบ", "Owner")}: ${signer.name}${signer.position ? " · " + signer.position : ""}`;
      doc.text(line, pageW - margin - stampW - doc.getTextWidth(line), margin + 24);
    }
    doc.line(margin, margin + headerH - 8, pageW - margin, margin + headerH - 8);

    // Footer
    doc.line(margin, pageH - margin - footerH + 4, pageW - margin, pageH - margin - footerH + 4);
    doc.setFontSize(8);
    doc.text(`${T("สร้างเมื่อ", "Generated")} ${generatedAt}`, margin, pageH - margin - 16);

    // Signature image (bottom-center / right of "ลงนาม" text)
    let sigOffset = 0;
    if (signature) {
      try {
        const props = doc.getImageProperties(signature);
        const maxH = footerH - 8, maxW = 90;
        const ratio = props.width / props.height;
        let sh = maxH, sw = sh * ratio;
        if (sw > maxW) { sw = maxW; sh = sw / ratio; }
        const sigX = pageW / 2 - sw / 2;
        doc.addImage(signature, detectImgFmt(signature), sigX, pageH - margin - footerH + 6, sw, sh);
        sigOffset = sw;
      } catch { /* ignore */ }
    }
    if (signer) {
      const sigLine = `${T("ลงนาม", "Signed")}: ${signer.name}${signer.position ? " (" + signer.position + ")" : ""}`;
      doc.text(sigLine, margin, pageH - margin - 4);
    }
    void sigOffset;
    const pageStr = `${T("หน้า", "Page")} ${p} / ${totalPages}`;
    doc.text(pageStr, pageW - margin - doc.getTextWidth(pageStr), pageH - margin - 4);
    doc.setTextColor(0);
  }

  doc.setProperties({
    title: `RathCoWork Monthly Report ${r.period.year}-${String(r.period.month).padStart(2, "0")}`,
    subject: "Monthly usage report",
    author: signer?.name || "RathCoWork",
    creator: "RathCoWork",
  });

  return doc.output("blob");
}

function drawDailyChart(doc: jsPDF, r: MonthlyReport, x: number, y: number, w: number, h: number) {
  const data = r.daily;

  // Title + legend (fit inside available width)
  doc.setFontSize(11); doc.setTextColor(20);
  doc.text("ต้นทุน/งาน รายวัน", x, y + 14);
  doc.setFontSize(8);
  const legendY = y + 8;
  const costLegendX = x + Math.min(w - 200, 180);
  doc.setFillColor(60, 90, 200);
  doc.rect(costLegendX, legendY, 10, 6, "F");
  doc.setTextColor(60); doc.text("ต้นทุน (USD)", costLegendX + 14, y + 14);
  const runsLegendX = costLegendX + 88;
  doc.setFillColor(170, 175, 185);
  doc.rect(runsLegendX, legendY, 10, 6, "F");
  doc.text("จำนวนงาน", runsLegendX + 14, y + 14);

  // Auto Y-axis padding from widest label
  const maxCost = data.length ? Math.max(...data.map((d) => d.cost), 0.0001) : 1;
  const maxRuns = data.length ? Math.max(...data.map((d) => d.runs), 1) : 1;
  doc.setFontSize(7);
  const costLabel = `$${maxCost.toFixed(3)}`;
  const runsLabel = String(maxRuns);
  const padL = Math.max(38, doc.getTextWidth(costLabel) + 10);
  const padR = Math.max(28, doc.getTextWidth(runsLabel) + 12);
  const rotateXLabels = data.length > 14;
  const padT = 24;
  const padB = rotateXLabels ? 38 : 28;

  const innerX = x + padL, innerY = y + padT;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  doc.setDrawColor(220);
  doc.rect(innerX, innerY, innerW, innerH);

  if (data.length === 0) {
    doc.setFontSize(9); doc.setTextColor(150);
    const msg = "ไม่มีข้อมูลในช่วงนี้";
    doc.text(msg, innerX + innerW / 2 - doc.getTextWidth(msg) / 2, innerY + innerH / 2);
    return;
  }

  // Grid + Y labels
  doc.setFontSize(7); doc.setTextColor(120);
  const grids = 4;
  for (let i = 0; i <= grids; i++) {
    const gy = innerY + (innerH * i) / grids;
    doc.setDrawColor(238);
    doc.line(innerX, gy, innerX + innerW, gy);
    const costVal = maxCost * (1 - i / grids);
    const runsVal = Math.round(maxRuns * (1 - i / grids));
    const ctxt = `$${costVal.toFixed(3)}`;
    doc.text(ctxt, innerX - 4 - doc.getTextWidth(ctxt), gy + 3);
    doc.text(String(runsVal), innerX + innerW + 4, gy + 3);
  }

  // Slot positions — use slot centers so first/last bars stay inside the frame
  const slotW = innerW / data.length;
  const ptX = (i: number) => innerX + slotW * (i + 0.5);
  const ptYCost = (v: number) => innerY + innerH - (v / maxCost) * innerH;
  const ptYRuns = (v: number) => innerY + innerH - (v / maxRuns) * innerH;

  // X labels — sample based on actual label width fit
  doc.setTextColor(120);
  const labelW = doc.getTextWidth("12-31");
  const maxLabels = Math.max(2, Math.floor(innerW / (labelW + (rotateXLabels ? 6 : 14))));
  const step = Math.max(1, Math.ceil(data.length / maxLabels));
  data.forEach((d, i) => {
    if (i % step !== 0 && i !== data.length - 1) return;
    const px = ptX(i);
    doc.setDrawColor(220);
    doc.line(px, innerY + innerH, px, innerY + innerH + 3);
    const txt = d.day.slice(5);
    if (rotateXLabels) {
      // rotate 45° CCW around anchor
      doc.text(txt, px - 2, innerY + innerH + 16, { angle: 45 });
    } else {
      doc.text(txt, px - doc.getTextWidth(txt) / 2, innerY + innerH + 14);
    }
  });

  // Bars (runs) — clamp width to slot
  const barW = Math.max(1.2, Math.min(14, slotW * 0.6));
  doc.setFillColor(190, 195, 205);
  data.forEach((d, i) => {
    const px = ptX(i) - barW / 2;
    const py = ptYRuns(d.runs);
    doc.rect(px, py, barW, innerY + innerH - py, "F");
  });

  // Cost line + dots
  doc.setDrawColor(60, 90, 200); doc.setLineWidth(1.4);
  for (let i = 1; i < data.length; i++) {
    doc.line(ptX(i - 1), ptYCost(data[i - 1].cost), ptX(i), ptYCost(data[i].cost));
  }
  doc.setFillColor(60, 90, 200);
  const dotR = data.length > 31 ? 1.0 : data.length > 18 ? 1.3 : 1.6;
  data.forEach((d, i) => doc.circle(ptX(i), ptYCost(d.cost), dotR, "F"));
  doc.setLineWidth(0.4);
  doc.setTextColor(0);
}


export function reportFilename(r: MonthlyReport, ext: "pdf" | "csv"): string {
  const m = String(r.period.month).padStart(2, "0");
  return `rathcowork-monthly-${r.period.year}-${m}.${ext}`;
}
