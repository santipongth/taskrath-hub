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

export async function buildMonthlyPdf(r: MonthlyReport): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await ensureSarabun(doc);
  doc.setFont("Sarabun", "normal");

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const headerH = 28;
  const footerH = 24;
  const contentTop = margin + headerH;
  const contentBottom = pageH - margin - footerH;
  let y = contentTop;
  const periodLabel = `${TH_MONTHS[r.period.month - 1]} ${r.period.year + 543}`;
  const generatedAt = new Date().toLocaleString("th-TH");

  const ensureSpace = (need: number) => {
    if (y + need > contentBottom) { doc.addPage(); y = contentTop; }
  };

  doc.setFontSize(16);
  doc.text("RathCoWork — รายงานการใช้งานรายเดือน", margin, y); y += 22;
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(`รอบการใช้งาน: ${periodLabel}`, margin, y); y += 14;
  doc.text(`สร้างเมื่อ: ${generatedAt}`, margin, y); y += 20;
  doc.setTextColor(0);

  // KPI grid
  doc.setFontSize(12);
  doc.text("ภาพรวม (KPI)", margin, y); y += 14;
  doc.setFontSize(10);
  const kpis: [string, string][] = [
    ["งานทั้งหมด", fmtInt(r.totals.runs)],
    ["ต้นทุนรวม", fmtCost(r.totals.costUsd)],
    ["โทเค็นรวม", fmtInt(r.totals.totalTokens)],
    ["Input tokens", fmtInt(r.totals.promptTokens)],
    ["Output tokens", fmtInt(r.totals.completionTokens)],
    ["อัตรา fail", `${(r.totals.failRate * 100).toFixed(2)}% (${r.totals.fails})`],
    ["ผู้ใช้ที่ใช้งาน", fmtInt(r.totals.uniqueUsers)],
    ["เทมเพลตที่ใช้", fmtInt(r.totals.uniqueTemplates)],
  ];
  const colW = (pageW - margin * 2) / 4;
  const rowH = 36;
  for (let i = 0; i < kpis.length; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    const x = margin + col * colW;
    const cy = y + row * rowH;
    doc.setDrawColor(220); doc.rect(x, cy, colW - 6, rowH - 4);
    doc.setTextColor(110); doc.setFontSize(8);
    doc.text(kpis[i][0], x + 6, cy + 12);
    doc.setTextColor(0); doc.setFontSize(11);
    doc.text(kpis[i][1], x + 6, cy + 26);
  }
  y += Math.ceil(kpis.length / 4) * rowH + 10;

  const drawTable = (title: string, head: string[], rows: string[][], widths: number[]) => {
    ensureSpace(40);
    doc.setFontSize(12); doc.setTextColor(0);
    doc.text(title, margin, y); y += 12;
    doc.setFontSize(9);
    // header
    ensureSpace(18);
    doc.setFillColor(245, 245, 245); doc.rect(margin, y, pageW - margin * 2, 16, "F");
    let x = margin + 4;
    doc.setTextColor(80);
    head.forEach((h, i) => { doc.text(h, x, y + 11); x += widths[i]; });
    y += 16;
    doc.setTextColor(0);
    rows.forEach((row) => {
      ensureSpace(14);
      let cx = margin + 4;
      row.forEach((cell, i) => {
        const txt = String(cell);
        const max = widths[i] - 4;
        const truncated = doc.getTextWidth(txt) > max ? truncate(doc, txt, max) : txt;
        doc.text(truncated, cx, y + 10);
        cx += widths[i];
      });
      doc.setDrawColor(235); doc.line(margin, y + 13, pageW - margin, y + 13);
      y += 14;
    });
    y += 10;
  };

  drawTable(
    "รายวัน",
    ["วันที่", "งาน", "โทเค็น", "ต้นทุน", "fails"],
    r.daily.map((d) => [d.day, fmtInt(d.runs), fmtInt(d.tokens), fmtCost(d.cost), String(d.fails)]),
    [100, 80, 100, 100, 60],
  );

  drawTable(
    "ผู้ใช้ (เรียงตามต้นทุน)",
    ["ชื่อ", "งาน", "โทเค็น", "ต้นทุน", "fails"],
    r.users.slice(0, 50).map((u) => [u.name, fmtInt(u.runs), fmtInt(u.tokens), fmtCost(u.cost), String(u.fails)]),
    [220, 60, 100, 100, 60],
  );

  drawTable(
    "เทมเพลต (เรียงตามจำนวนงาน)",
    ["Template", "งาน", "เฉลี่ย tok", "ต้นทุน", "fail %"],
    r.templates.slice(0, 50).map((t) => [t.id, fmtInt(t.runs), fmtInt(t.avgTokens), fmtCost(t.cost), `${(t.failRate * 100).toFixed(1)}%`]),
    [220, 60, 80, 100, 80],
  );

  doc.setProperties({
    title: `RathCoWork Monthly Report ${r.period.year}-${String(r.period.month).padStart(2, "0")}`,
    subject: "Monthly usage report",
    author: "RathCoWork",
    creator: "RathCoWork",
  });

  return doc.output("blob");
}

function truncate(doc: jsPDF, txt: string, max: number): string {
  let s = txt;
  while (doc.getTextWidth(s + "…") > max && s.length > 1) s = s.slice(0, -1);
  return s + "…";
}

export function reportFilename(r: MonthlyReport, ext: "pdf" | "csv"): string {
  const m = String(r.period.month).padStart(2, "0");
  return `rathcowork-monthly-${r.period.year}-${m}.${ext}`;
}
