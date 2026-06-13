import { jsPDF } from "jspdf";
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, PageNumber,
  Footer, ImageRun,
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

export type Classification = "ปกติ" | "ลับ" | "ลับมาก" | "ลับที่สุด";
export type Urgency = "ปกติ" | "ด่วน" | "ด่วนมาก" | "ด่วนที่สุด";

export type SignatureBlock = {
  signerName: string;
  signerPosition: string;
  signatureImageDataUrl?: string | null; // data:image/png;base64,...
  qrDataUrl: string;                      // data:image/png;base64,... linking to verify
  verifyUrl: string;
  signatureId: string;
  contentHash: string;
  signedAtIso: string;
};

export type ExportOptions = {
  classification?: Classification;
  urgency?: Urgency;
  refNo?: string;
  recipient?: string;
  includeLetterhead?: boolean;
  letterheadBytes?: Uint8Array | null;
  letterheadMime?: "png" | "jpg";
  signature?: SignatureBlock | null;
};

const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function thaiDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

const FONT = "Sarabun";
const SIZE_BODY = 32;
const SIZE_HEADER = 36;
const SIZE_CLASS = 44;

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

function borderless() {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
}

export async function exportRunToDocx(
  run: RunLike,
  templateTitle: string,
  agency?: AgencySettings | null,
  options: ExportOptions = {},
) {
  const ag = agency ?? null;
  const refNo = options.refNo?.trim() || `ที่ ${run.template_id ?? "อว"}/${run.id.slice(0, 6).toUpperCase()}`;
  const date = thaiDate(run.created_at);
  const subject = run.title?.trim() || templateTitle;
  const classification = options.classification && options.classification !== "ปกติ" ? options.classification : null;
  const urgency = options.urgency && options.urgency !== "ปกติ" ? options.urgency : null;
  const inputs = (run.input ?? {}) as Record<string, unknown>;
  const recipient = options.recipient?.trim() ||
    (typeof inputs.recipient === "string" && inputs.recipient) ||
    (typeof inputs.to === "string" && inputs.to) ||
    "ผู้เกี่ยวข้อง";

  const topBlocks: Paragraph[] = [];

  if (options.includeLetterhead && options.letterheadBytes && options.letterheadBytes.length > 0) {
    topBlocks.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new ImageRun({
        type: options.letterheadMime === "jpg" ? "jpg" : "png",
        data: options.letterheadBytes,
        transformation: { width: 70, height: 70 },
        altText: { title: "ตราครุฑ", description: "Garuda emblem", name: "garuda" },
      })],
    }));
  }

  if (classification) {
    topBlocks.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [tr(classification, { bold: true, color: "C00000", size: SIZE_CLASS })],
    }));
  }

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
              ...(ag?.subUnit ? [p(ag.subUnit)] : []),
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
              ...(urgency ? [new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [tr(urgency, { bold: true, color: "C00000" })],
              })] : []),
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

  const sig = options.signature ?? null;
  const signerNameLine = sig?.signerName || ag?.signerName || "(……………………………)";
  const signerPosLine = sig?.signerPosition || ag?.signerPosition || "ตำแหน่ง";

  const signOff: Paragraph[] = [
    new Paragraph({ spacing: { before: 480 }, alignment: AlignmentType.CENTER, children: [tr("ขอแสดงความนับถือ")] }),
  ];

  if (sig?.signatureImageDataUrl) {
    const sigBytes = dataUrlToBytes(sig.signatureImageDataUrl);
    if (sigBytes) {
      signOff.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 0 },
        children: [new ImageRun({
          type: sig.signatureImageDataUrl.includes("image/jpeg") ? "jpg" : "png",
          data: sigBytes,
          transformation: { width: 140, height: 60 },
          altText: { title: "ลายเซ็น", description: "Digital signature", name: "signature" },
        })],
      }));
    }
  } else {
    signOff.push(new Paragraph({ spacing: { before: 720 }, children: [tr(" ")] }));
  }

  signOff.push(
    new Paragraph({ alignment: AlignmentType.CENTER, children: [tr(signerNameLine, { bold: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [tr(signerPosLine)] }),
  );

  const signOffTable = sig ? new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1600, 7760],
    rows: [new TableRow({ children: [
      (() => {
        const qrBytes = dataUrlToBytes(sig.qrDataUrl);
        return qrBytes ? new TableCell({
          borders: borderless(),
          width: { size: 1600, type: WidthType.DXA },
          children: [new Paragraph({ children: [new ImageRun({
            type: "png", data: qrBytes,
            transformation: { width: 90, height: 90 },
            altText: { title: "QR", description: sig.verifyUrl, name: "verify-qr" },
          })] })],
        }) : new TableCell({ borders: borderless(), width: { size: 1600, type: WidthType.DXA }, children: [p(" ")] });
      })(),
      new TableCell({
        borders: borderless(),
        width: { size: 7760, type: WidthType.DXA },
        margins: { top: 0, bottom: 0, left: 120, right: 0 },
        children: [
          new Paragraph({ children: [tr("ลงนามด้วยลายเซ็นอิเล็กทรอนิกส์", { bold: true, size: 22 })] }),
          new Paragraph({ children: [tr(`เมื่อ ${new Date(sig.signedAtIso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}`, { size: 20, color: "555555" })] }),
          new Paragraph({ children: [tr(`รหัสลายเซ็น: ${sig.signatureId}`, { size: 18, color: "777777" })] }),
          new Paragraph({ children: [tr(`SHA-256: ${sig.contentHash.slice(0, 32)}…`, { size: 18, color: "777777" })] }),
          new Paragraph({ children: [tr(`ตรวจสอบที่ ${sig.verifyUrl}`, { size: 18, color: "1155CC" })] }),
          new Paragraph({ children: [tr("ตาม พ.ร.บ.ว่าด้วยธุรกรรมทางอิเล็กทรอนิกส์ พ.ศ. 2544", { size: 18, italics: true, color: "777777" })] }),
        ],
      }),
    ]})],
  }) : null;

  const doc = new Document({
    creator: "TaskRath",
    title: subject,
    styles: { default: { document: { run: { font: FONT, size: SIZE_BODY } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1701, right: 1134, bottom: 1701, left: 1701 },
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
          ...topBlocks,
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

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export async function exportRunToPdf(
  run: RunLike,
  templateTitle: string,
  agency?: AgencySettings | null,
  options: ExportOptions = {},
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await ensureSarabun(doc);

  const margin = 56;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usable = pageWidth - margin * 2;
  let y = margin;

  const classification = options.classification && options.classification !== "ปกติ" ? options.classification : null;
  const urgency = options.urgency && options.urgency !== "ปกติ" ? options.urgency : null;

  if (options.includeLetterhead && options.letterheadBytes && options.letterheadBytes.length > 0) {
    try {
      const fmt = options.letterheadMime === "jpg" ? "JPEG" : "PNG";
      const dataUrl = `data:image/${options.letterheadMime ?? "png"};base64,${bytesToBase64(options.letterheadBytes)}`;
      const imgSize = 60;
      doc.addImage(dataUrl, fmt, pageWidth / 2 - imgSize / 2, y, imgSize, imgSize);
      y += imgSize + 8;
    } catch {
      /* ignore image errors */
    }
  }

  if (classification) {
    doc.setFont("Sarabun", "bold");
    doc.setFontSize(16);
    doc.setTextColor(192, 0, 0);
    doc.text(classification, pageWidth / 2, y + 6, { align: "center" });
    y += 22;
  }

  if (agency?.name) {
    doc.setFont("Sarabun", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20);
    doc.text(agency.name, margin, y);
    y += 18;
    if (agency.subUnit) {
      doc.setFont("Sarabun", "normal");
      doc.setFontSize(11);
      doc.setTextColor(60);
      doc.text(agency.subUnit, margin, y);
      y += 14;
    }
    if (agency.address) {
      doc.setFont("Sarabun", "normal");
      doc.setFontSize(10);
      doc.setTextColor(90);
      const addrLines = doc.splitTextToSize(agency.address, usable - 200) as string[];
      for (const l of addrLines) { doc.text(l, margin, y); y += 12; }
    }
  }

  const refNo = options.refNo?.trim() || `ที่ ${run.template_id ?? "อว"}/${run.id.slice(0, 6).toUpperCase()}`;
  const date = thaiDate(run.created_at);
  doc.setFont("Sarabun", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  const topRightY = options.includeLetterhead && options.letterheadBytes ? margin + 70 : margin;
  doc.text(refNo, pageWidth - margin, topRightY, { align: "right" });
  doc.text(date, pageWidth - margin, topRightY + 14, { align: "right" });
  if (urgency) {
    doc.setFont("Sarabun", "bold");
    doc.setTextColor(192, 0, 0);
    doc.text(urgency, pageWidth - margin, topRightY + 30, { align: "right" });
    doc.setTextColor(60);
  }

  y = Math.max(y, topRightY + 50);
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  const subject = run.title?.trim() || templateTitle;
  doc.setFont("Sarabun", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20);
  const titleLines = doc.splitTextToSize(`เรื่อง  ${subject}`, usable) as string[];
  for (const l of titleLines) { doc.text(l, margin, y); y += 18; }
  y += 4;

  const inputs = (run.input ?? {}) as Record<string, unknown>;
  const recipient = options.recipient?.trim() ||
    (typeof inputs.recipient === "string" && inputs.recipient) ||
    (typeof inputs.to === "string" && inputs.to) ||
    "ผู้เกี่ยวข้อง";
  doc.setFont("Sarabun", "bold");
  doc.text(`เรียน  ${recipient}`, margin, y);
  y += 22;

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
