import sarabunRegularUrl from "@/assets/fonts/Sarabun-Regular.ttf?url";
import sarabunBoldUrl from "@/assets/fonts/Sarabun-Bold.ttf?url";
import type { jsPDF } from "jspdf";

let cache: Promise<{ regular: string; bold: string }> | null = null;

async function ttfToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin);
}

function loadFonts() {
  if (!cache) {
    cache = Promise.all([ttfToBase64(sarabunRegularUrl), ttfToBase64(sarabunBoldUrl)])
      .then(([regular, bold]) => ({ regular, bold }));
  }
  return cache;
}

/**
 * Register Sarabun (Thai-capable) into a jsPDF instance and select it.
 * After this call you can use doc.setFont("Sarabun", "normal" | "bold").
 */
export async function ensureSarabun(doc: jsPDF): Promise<void> {
  const { regular, bold } = await loadFonts();
  doc.addFileToVFS("Sarabun-Regular.ttf", regular);
  doc.addFont("Sarabun-Regular.ttf", "Sarabun", "normal");
  doc.addFileToVFS("Sarabun-Bold.ttf", bold);
  doc.addFont("Sarabun-Bold.ttf", "Sarabun", "bold");
  doc.setFont("Sarabun", "normal");
}
