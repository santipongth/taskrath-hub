// Smoke test for /run page attachment processing.
// Mirrors the helpers in src/routes/_authenticated/run/index.tsx and validates
// that image / PDF / text files are classified, encoded, and counted correctly.
//
// Run with:  bun scripts/test-run-attachments.mjs
//        or: node scripts/test-run-attachments.mjs
//
// Exits non-zero if any assertion fails.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|yaml|yml|log|html?|css|js|ts|tsx|jsx|py|sql)$/i;

function estimatePdfPages(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return (s.match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
}

function classify(name, mime) {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (mime.startsWith("text/") || TEXT_EXT.test(name) || mime === "application/json") return "text";
  return null;
}

function processFile(filePath, mime = "") {
  const buf = fs.readFileSync(filePath);
  const name = path.basename(filePath);
  const kind = classify(name, mime);
  if (!kind) throw new Error(`unsupported: ${name}`);
  if (kind === "text") {
    const data = buf.toString("utf-8");
    return { name, kind, size: buf.length, textLen: data.length, data };
  }
  if (kind === "pdf") {
    const pages = estimatePdfPages(buf);
    const data = `data:application/pdf;base64,${buf.toString("base64")}`;
    return { name, kind, size: buf.length, pages, data };
  }
  // image
  const data = `data:${mime || "image/png"};base64,${buf.toString("base64")}`;
  return { name, kind, size: buf.length, data };
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("ok  :", msg);
}

// ── Fixtures ────────────────────────────────────────────────────────────────
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "run-att-"));
const txtPath = path.join(tmp, "sample.txt");
const pngPath = path.join(tmp, "sample.png");
const pdfPath = path.join(tmp, "sample.pdf");

fs.writeFileSync(txtPath, "This is a sample text file for testing the freeform run feature.");

// 1×1 transparent PNG
const png1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
fs.writeFileSync(pngPath, png1x1);

// Minimal 1-page PDF (handcrafted)
const pdfBytes = Buffer.from(
  `%PDF-1.1
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000052 00000 n
0000000099 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
150
%%EOF`,
);
fs.writeFileSync(pdfPath, pdfBytes);

// ── Tests ───────────────────────────────────────────────────────────────────
const text = processFile(txtPath, "text/plain");
assert(text.kind === "text", "text file classified as text");
assert(text.textLen >= 20, "text content above minimum length");
assert(typeof text.data === "string" && text.data.includes("freeform"), "text content preserved");

const image = processFile(pngPath, "image/png");
assert(image.kind === "image", "PNG classified as image");
assert(image.data.startsWith("data:image/png;base64,"), "image encoded as data URL");
assert(image.size > 0, "image size > 0");

const pdf = processFile(pdfPath, "application/pdf");
assert(pdf.kind === "pdf", "PDF classified as pdf");
assert(pdf.pages === 1, `PDF page count = 1 (got ${pdf.pages})`);
assert(pdf.data.startsWith("data:application/pdf;base64,"), "PDF encoded as data URL");

// Unsupported extension should throw
let threw = false;
try {
  fs.writeFileSync(path.join(tmp, "bad.bin"), Buffer.from([0, 1, 2]));
  processFile(path.join(tmp, "bad.bin"), "application/octet-stream");
} catch {
  threw = true;
}
assert(threw, "unsupported file type rejected");

// PDF-by-extension (no mime) still detected
const pdfByExt = processFile(pdfPath, "");
assert(pdfByExt.kind === "pdf", "PDF detected by .pdf extension when mime missing");

// Empty file → size 0 (UI rejects this before processing; we just verify detection)
const emptyPath = path.join(tmp, "empty.txt");
fs.writeFileSync(emptyPath, "");
const empty = processFile(emptyPath, "text/plain");
assert(empty.size === 0 && empty.textLen === 0, "empty file size/length = 0");

// Clean up
try { execSync(`rm -rf ${tmp}`); } catch { /* ignore */ }

console.log("\nAll attachment-processing checks passed.");
