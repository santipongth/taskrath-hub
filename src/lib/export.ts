import { jsPDF } from "jspdf";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
} from "docx";

type RunLike = {
  id: string;
  title?: string | null;
  output?: string | null;
  created_at: string;
  input?: Record<string, unknown> | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { dateStyle: "long", timeStyle: "short" });
}

/**
 * Export to PDF. Uses jsPDF default font (Helvetica) — Thai glyphs may not
 * render with the built-in font, so the output is best for Latin text or
 * environments where users install Sarabun in the viewer. For mixed/Thai
 * content prefer the DOCX export.
 */
export function exportRunToPdf(run: RunLike, templateTitle: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 56;
  const pageWidth = doc.internal.pageSize.getWidth();
  const usable = pageWidth - margin * 2;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(templateTitle, margin, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(formatDate(run.created_at), margin, y);
  y += 18;
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  doc.setTextColor(20);
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(run.output ?? "", usable);
  const pageHeight = doc.internal.pageSize.getHeight();
  for (const line of lines as string[]) {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 16;
  }

  doc.save(`${sanitize(templateTitle)}-${run.id.slice(0, 8)}.pdf`);
}

export async function exportRunToDocx(run: RunLike, templateTitle: string) {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: templateTitle, bold: true, font: "Sarabun" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: formatDate(run.created_at), italics: true, color: "666666", font: "Sarabun" })],
    }),
    new Paragraph({ children: [new TextRun("")] }),
  ];

  for (const block of (run.output ?? "").split(/\n{2,}/)) {
    paragraphs.push(
      new Paragraph({
        children: block.split("\n").map((line, i) =>
          new TextRun({ text: line, break: i === 0 ? undefined : 1, font: "Sarabun" }),
        ),
      }),
    );
  }

  const doc = new Document({
    creator: "TaskRath",
    title: templateTitle,
    sections: [{ properties: {}, children: paragraphs }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitize(templateTitle)}-${run.id.slice(0, 8)}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function sanitize(s: string) {
  return s.replace(/[^\w\u0E00-\u0E7F-]+/g, "_").slice(0, 60) || "document";
}
