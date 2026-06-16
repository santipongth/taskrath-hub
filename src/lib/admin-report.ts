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
/** Either may be a `data:image/png|jpeg;base64,...` URL (any size; auto-fit in header/footer). */
export type BuildOptions = {
  signer?: Signer | null;
  signatureDataUrl?: string | null;
  stampDataUrl?: string | null;
};

function detectImgFmt(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg") ? "JPEG" : "PNG";
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
  const periodLabel = `${TH_MONTHS[r.period.month - 1]} ${r.period.year + 543}`;
  const generatedAt = new Date().toLocaleString("th-TH");
  const signer = opts.signer && (opts.signer.name || opts.signer.position) ? opts.signer : null;

  const ensureSpace = (need: number) => {
    if (y + need > contentBottom) { doc.addPage(); y = contentTop; }
  };

  doc.setFontSize(16);
  doc.text("RathCoWork — รายงานการใช้งานรายเดือน", margin, y); y += 22;
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(`รอบการใช้งาน: ${periodLabel}`, margin, y); y += 14;
  doc.text(`สร้างเมื่อ: ${generatedAt}`, margin, y); y += 18;
  doc.setTextColor(0);

  // KPI grid
  doc.setFontSize(12);
  doc.text("ภาพรวม (KPI)", margin, y); y += 12;
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
    doc.text("RathCoWork · รายงานการใช้งานรายเดือน", margin, margin + 12);

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
      const line = `ผู้รับผิดชอบ: ${signer.name}${signer.position ? " · " + signer.position : ""}`;
      doc.text(line, pageW - margin - stampW - doc.getTextWidth(line), margin + 24);
    }
    doc.line(margin, margin + headerH - 8, pageW - margin, margin + headerH - 8);

    // Footer
    doc.line(margin, pageH - margin - footerH + 4, pageW - margin, pageH - margin - footerH + 4);
    doc.setFontSize(8);
    doc.text(`สร้างเมื่อ ${generatedAt}`, margin, pageH - margin - 16);

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
      const sigLine = `ลงนาม: ${signer.name}${signer.position ? " (" + signer.position + ")" : ""}`;
      doc.text(sigLine, margin, pageH - margin - 4);
    }
    void sigOffset;
    const pageStr = `หน้า ${p} / ${totalPages}`;
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
  const padL = 50, padR = 50, padT = 24, padB = 28;
  const innerX = x + padL, innerY = y + padT;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  doc.setFontSize(11); doc.setTextColor(20);
  doc.text("ต้นทุน/งาน รายวัน", x, y + 14);
  doc.setFontSize(8);
  doc.setFillColor(60, 90, 200);
  doc.rect(x + 160, y + 8, 10, 6, "F");
  doc.setTextColor(60); doc.text("ต้นทุน (USD)", x + 174, y + 14);
  doc.setFillColor(170, 175, 185);
  doc.rect(x + 250, y + 8, 10, 6, "F");
  doc.text("จำนวนงาน", x + 264, y + 14);

  doc.setDrawColor(220);
  doc.rect(innerX, innerY, innerW, innerH);

  const data = r.daily;
  if (data.length === 0) {
    doc.setFontSize(9); doc.setTextColor(150);
    doc.text("ไม่มีข้อมูลในช่วงนี้", innerX + innerW / 2 - 30, innerY + innerH / 2);
    return;
  }

  const maxCost = Math.max(...data.map((d) => d.cost), 0.0001);
  const maxRuns = Math.max(...data.map((d) => d.runs), 1);

  doc.setFontSize(7); doc.setTextColor(120);
  const grids = 4;
  for (let i = 0; i <= grids; i++) {
    const gy = innerY + (innerH * i) / grids;
    doc.setDrawColor(238);
    doc.line(innerX, gy, innerX + innerW, gy);
    const costVal = maxCost * (1 - i / grids);
    const runsVal = Math.round(maxRuns * (1 - i / grids));
    doc.text(`$${costVal.toFixed(3)}`, x + 4, gy + 3);
    doc.text(String(runsVal), x + w - padR + 6, gy + 3);
  }

  const step = Math.max(1, Math.ceil(data.length / 8));
  data.forEach((d, i) => {
    if (i % step !== 0 && i !== data.length - 1) return;
    const px = innerX + (data.length === 1 ? innerW / 2 : (innerW * i) / (data.length - 1));
    doc.setDrawColor(220);
    doc.line(px, innerY + innerH, px, innerY + innerH + 3);
    doc.text(d.day.slice(5), px - 9, innerY + innerH + 14);
  });

  const ptX = (i: number) => innerX + (data.length === 1 ? innerW / 2 : (innerW * i) / (data.length - 1));
  const ptYCost = (v: number) => innerY + innerH - (v / maxCost) * innerH;
  const ptYRuns = (v: number) => innerY + innerH - (v / maxRuns) * innerH;

  const barW = Math.max(2, (innerW / data.length) * 0.5);
  doc.setFillColor(190, 195, 205);
  data.forEach((d, i) => {
    const px = ptX(i) - barW / 2;
    const py = ptYRuns(d.runs);
    doc.rect(px, py, barW, innerY + innerH - py, "F");
  });

  doc.setDrawColor(60, 90, 200); doc.setLineWidth(1.4);
  for (let i = 1; i < data.length; i++) {
    doc.line(ptX(i - 1), ptYCost(data[i - 1].cost), ptX(i), ptYCost(data[i].cost));
  }
  doc.setFillColor(60, 90, 200);
  data.forEach((d, i) => doc.circle(ptX(i), ptYCost(d.cost), 1.6, "F"));
  doc.setLineWidth(0.4);
  doc.setTextColor(0);
}


export function reportFilename(r: MonthlyReport, ext: "pdf" | "csv"): string {
  const m = String(r.period.month).padStart(2, "0");
  return `rathcowork-monthly-${r.period.year}-${m}.${ext}`;
}
