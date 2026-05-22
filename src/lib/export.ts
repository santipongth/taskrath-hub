import { jsPDF } from "jspdf";
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, PageNumber,
  Footer,
} from "docx";
import type { AgencySettings } from "@/lib/admin.functions";
import { ensureSarabun } from "@/lib/pdf-fonts";

type RunLike = {
  id: string;
  title?: string | null;
  output?: string | null;
  created_at: string;
  input?: unknown;
  template_id?: string | null;
};

const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function thaiDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { dateStyle: "long", timeStyle: "short" });
}

const FONT = "Sarabun";
const SIZE_BODY = 32;     // half-points → 16pt
const SIZE_HEADER = 36;   // 18pt
const SIZE_TITLE = 40;    // 20pt

function tr(text: string, opts: { bold?: boolean; size?: number; italics?: boolean; color?: string } = {}) {
  return new TextRun({
    text,
    font: FONT,
    size: opts.size ?? SIZE_BODY,
    bold: opts.bold,
    italics: opts.italics,
    color: opts.color,
  });
}

function p(text: string, opts: Parameters<typeof tr>[1] & { align?: typeof AlignmentType[keyof typeof AlignmentType] } = {}) {
  return new Paragraph({
    alignment: opts.align,
    spacing: { line: 360 },
    children: [tr(text, opts)],
  });
}

/**
 * Thai government official letter (หนังสือราชการภายนอก) DOCX.
 * Layout follows ระเบียบสำนักนายกรัฐมนตรีว่าด้วยงานสารบรรณ:
 * - ส่วนราชการเจ้าของเรื่อง + ที่ + วันที่
 * - เรื่อง / เรียน
 * - เนื้อหา
 * - คำลงท้าย + ลงนาม + ตำแหน่ง
 */
export async function exportRunToDocx(
  run: RunLike,
  templateTitle: string,
  agency?: AgencySettings | null,
) {
  const ag = agency ?? null;
  const refNo = `ที่ ${run.template_id ?? "อว"}/${run.id.slice(0, 6).toUpperCase()}`;
  const date = thaiDate(run.created_at);
  const subject = run.title?.trim() || templateTitle;

  // Header table: left = agency block, right = ref no + date
  const headerTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [5400, 3960],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: borderless(),
            width: { size: 5400, type: WidthType.DXA },
            margins: { top: 60, bottom: 60, left: 0, right: 80 },
            children: [
              p(ag?.name || "ส่วนราชการ", { bold: true, size: SIZE_HEADER }),
              ...(ag?.address ? [p(ag.address)] : []),
              ...(ag?.phone || ag?.email
                ? [p([ag?.phone && `โทร. ${ag.phone}`, ag?.email && `อีเมล ${ag.email}`].filter(Boolean).join("  "))]
                : []),
            ],
          }),
          new TableCell({
            borders: borderless(),
            width: { size: 3960, type: WidthType.DXA },
            margins: { top: 60, bottom: 60, left: 80, right: 0 },
            children: [
              p(refNo, { align: AlignmentType.RIGHT }),
              p(date, { align: AlignmentType.RIGHT }),
            ],
          }),
        ],
      }),
    ],
  });

  const subjectLine = new Paragraph({
    spacing: { before: 240, line: 360 },
    children: [tr("เรื่อง  ", { bold: true }), tr(subject)],
  });

  // 'เรียน' from inputs.recipient if present, else generic
  const inputs = (run.input ?? {}) as Record<string, unknown>;
  const recipient = (typeof inputs.recipient === "string" && inputs.recipient) ||
    (typeof inputs.to === "string" && inputs.to) ||
    "ผู้เกี่ยวข้อง";
  const recipientLine = new Paragraph({
    spacing: { line: 360 },
    children: [tr("เรียน  ", { bold: true }), tr(String(recipient))],
  });

  const body: Paragraph[] = [];
  const text = run.output ?? "";
  for (const block of text.split(/\n{2,}/)) {
    if (!block.trim()) continue;
    const lines = block.split("\n");
    const children: TextRun[] = [];
    lines.forEach((line, i) => {
      if (i > 0) children.push(new TextRun({ text: "", break: 1, font: FONT, size: SIZE_BODY }));
      children.push(tr(line));
    });
    body.push(new Paragraph({ spacing: { before: 120, line: 360 }, indent: { firstLine: 720 }, children }));
  }

  // Sign-off block (right-aligned)
  const signOff: Paragraph[] = [
    new Paragraph({ spacing: { before: 480 }, alignment: AlignmentType.CENTER, children: [tr("ขอแสดงความนับถือ")] }),
    new Paragraph({ spacing: { before: 720 }, alignment: AlignmentType.CENTER, children: [tr(ag?.signerName || "(……………………………)", { bold: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [tr(ag?.signerPosition || "ตำแหน่ง")] }),
  ];

  const doc = new Document({
    creator: "TaskRath",
    title: subject,
    styles: {
      default: { document: { run: { font: FONT, size: SIZE_BODY } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1701, right: 1134, bottom: 1701, left: 1701 }, // ขอบ ๓ ซม. บน/ล่าง/ซ้าย, ๒ ซม. ขวา
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  tr("- ", { color: "999999" }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 24, color: "999999" }),
                  tr(" -", { color: "999999" }),
                ],
              }),
            ],
          }),
        },
        children: [
          headerTable,
          new Paragraph({ children: [new TextRun("")], spacing: { before: 120 } }),
          subjectLine,
          recipientLine,
          ...body,
          ...signOff,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${sanitize(subject)}-${run.id.slice(0, 8)}.docx`);
}

function borderless() {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function sanitize(s: string) {
  return s.replace(/[^\w\u0E00-\u0E7F-]+/g, "_").slice(0, 60) || "document";
}

/**
 * PDF export with embedded Sarabun font for full Thai support.
 * Loads ~180KB of TTF data lazily on first export.
 */
export async function exportRunToPdf(
  run: RunLike,
  templateTitle: string,
  agency?: AgencySettings | null,
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await ensureSarabun(doc);

  const margin = 56;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usable = pageWidth - margin * 2;
  let y = margin;

  if (agency?.name) {
    doc.setFont("Sarabun", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20);
    doc.text(agency.name, margin, y);
    y += 18;
    if (agency.address) {
      doc.setFont("Sarabun", "normal");
      doc.setFontSize(10);
      doc.setTextColor(90);
      const addrLines = doc.splitTextToSize(agency.address, usable) as string[];
      for (const l of addrLines) { doc.text(l, margin, y); y += 12; }
    }
  }

  const refNo = `ที่ ${run.template_id ?? "อว"}/${run.id.slice(0, 6).toUpperCase()}`;
  const date = thaiDate(run.created_at);
  doc.setFont("Sarabun", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(refNo, pageWidth - margin, margin, { align: "right" });
  doc.text(date, pageWidth - margin, margin + 14, { align: "right" });

  y = Math.max(y, margin + 40);
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  const subject = run.title?.trim() || templateTitle;
  doc.setFont("Sarabun", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20);
  const titleLines = doc.splitTextToSize(`เรื่อง  ${subject}`, usable) as string[];
  for (const l of titleLines) { doc.text(l, margin, y); y += 18; }
  y += 6;

  doc.setFont("Sarabun", "normal");
  doc.setFontSize(12);
  doc.setTextColor(30);
  const text = run.output ?? "";
  for (const para of text.split(/\n{2,}/)) {
    if (!para.trim()) continue;
    const lines = doc.splitTextToSize(para, usable) as string[];
    for (const line of lines) {
      if (y > pageHeight - margin - 40) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += 16;
    }
    y += 8;
  }

  if (agency?.signerName || agency?.signerPosition) {
    if (y > pageHeight - margin - 80) { doc.addPage(); y = margin; }
    y += 24;
    doc.setFont("Sarabun", "normal");
    doc.text("ขอแสดงความนับถือ", pageWidth / 2, y, { align: "center" });
    y += 36;
    if (agency.signerName) {
      doc.setFont("Sarabun", "bold");
      doc.text(agency.signerName, pageWidth / 2, y, { align: "center" });
      y += 16;
    }
    if (agency.signerPosition) {
      doc.setFont("Sarabun", "normal");
      doc.text(agency.signerPosition, pageWidth / 2, y, { align: "center" });
    }
  }

  doc.save(`${sanitize(subject)}-${run.id.slice(0, 8)}.pdf`);
}
