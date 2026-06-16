import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ───────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────

async function assertAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data !== true) throw new Error("Forbidden: admin role required");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logAudit(supabase: any, userId: string, action: string, resource: string | null, metadata: Record<string, unknown>) {
  void userId;
  await supabase.rpc("log_audit", { p_action: action, p_resource: resource, p_metadata: metadata });
}

const EMBED_MODEL = "openai/text-embedding-3-small";
const EMBED_DIM = 1536;

async function embedBatch(texts: string[]): Promise<number[][]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI service not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts, dimensions: EMBED_DIM }),
  });
  if (res.status === 429) throw new Error("Rate limit exceeded — please try again shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted.");
  if (!res.ok) throw new Error(`Embedding error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return (json.data as { embedding: number[] }[]).map((d) => d.embedding);
}

// Format a vector for pgvector text input: "[0.1,0.2,...]"
function toPgVector(v: number[]): string {
  return `[${v.join(",")}]`;
}

// Split text into ~chunkSize-char chunks at paragraph/sentence boundaries with overlap.
function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (clean.length <= chunkSize) return clean ? [clean] : [];

  // Split by paragraphs first
  const paragraphs = clean.split(/\n{2,}/);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paragraphs) {
    if (!p.trim()) continue;
    if ((buf + "\n\n" + p).length <= chunkSize) {
      buf = buf ? buf + "\n\n" + p : p;
    } else {
      if (buf) chunks.push(buf);
      if (p.length <= chunkSize) {
        buf = p;
      } else {
        // Hard split long paragraph
        for (let i = 0; i < p.length; i += chunkSize - overlap) {
          chunks.push(p.slice(i, i + chunkSize));
        }
        buf = "";
      }
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

// Extract text from a PDF data URL via Gemini multimodal (Lovable Gateway).
async function extractPdfText(dataUrl: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI service not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "ดึงข้อความทั้งหมดในเอกสารออกมาเป็น plain text รักษาลำดับ ย่อหน้า เลขข้อ และตาราง คืนเฉพาะข้อความ ไม่ต้องอธิบาย",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "เอกสารด้านล่างเป็นระเบียบ/หนังสือเวียนราชการไทย จงดึงข้อความออกมา" },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`PDF extract error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return (json.choices?.[0]?.message?.content ?? "").trim();
}

// ───────────────────────────────────────────────────────────
// Server functions
// ───────────────────────────────────────────────────────────

export const listKbDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("kb_documents")
      .select("id, title, category, source, status, chunk_count, error, uploaded_by, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { documents: data ?? [] };
  });

export const uploadKbDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().min(1).max(200),
        category: z.enum(["regulation", "circular", "manual", "law", "other"]).default("other"),
        source: z.string().max(300).optional(),
        // Either raw text content OR a PDF data URL
        content: z.string().max(2_000_000).optional(),
        pdfDataUrl: z.string().max(20_000_000).optional(),
      })
      .refine((d) => d.content || d.pdfDataUrl, { message: "content or pdfDataUrl required" })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    // 1. Create the document row in processing state
    const { data: doc, error: e0 } = await supabase
      .from("kb_documents")
      .insert({
        title: data.title,
        category: data.category,
        source: data.source ?? null,
        mime_type: data.pdfDataUrl ? "application/pdf" : "text/plain",
        status: "processing",
        uploaded_by: userId,
      })
      .select("id")
      .single();
    if (e0) throw new Error(e0.message);
    const docId: string = doc.id;

    try {
      // 2. Extract text
      let text = data.content ?? "";
      if (data.pdfDataUrl) {
        text = await extractPdfText(data.pdfDataUrl);
      }
      if (!text.trim()) throw new Error("ไม่พบเนื้อหาในเอกสาร");

      // 3. Chunk
      const chunks = chunkText(text, 800, 100);
      if (chunks.length === 0) throw new Error("ไม่สามารถแบ่งเนื้อหาได้");
      if (chunks.length > 1000) throw new Error("เอกสารใหญ่เกินไป (>1000 chunks)");

      // 4. Embed in batches of 64
      const allEmbeddings: number[][] = [];
      for (let i = 0; i < chunks.length; i += 64) {
        const batch = chunks.slice(i, i + 64);
        const embs = await embedBatch(batch);
        allEmbeddings.push(...embs);
      }

      // 5. Insert chunks
      const rows = chunks.map((content, idx) => ({
        document_id: docId,
        chunk_index: idx,
        content,
        tokens: Math.ceil(content.length / 4),
        embedding: toPgVector(allEmbeddings[idx]),
      }));
      // Insert in batches of 100
      for (let i = 0; i < rows.length; i += 100) {
        const { error: eIns } = await supabase.from("kb_chunks").insert(rows.slice(i, i + 100));
        if (eIns) throw new Error(eIns.message);
      }

      // 6. Mark ready
      await supabase
        .from("kb_documents")
        .update({ status: "ready", chunk_count: chunks.length, error: null })
        .eq("id", docId);

      await logAudit(supabase, userId, "kb.upload", docId, {
        title: data.title,
        category: data.category,
        chunks: chunks.length,
      });

      return { id: docId, chunks: chunks.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await supabase
        .from("kb_documents")
        .update({ status: "failed", error: message })
        .eq("id", docId);
      await logAudit(supabase, userId, "kb.upload_failed", docId, { error: message });
      throw err;
    }
  });

export const deleteKbDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("kb_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(supabase, userId, "kb.delete", data.id, {});
    return { ok: true };
  });

export const searchKb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        query: z.string().min(1).max(2000),
        topK: z.number().int().min(1).max(20).default(5),
        threshold: z.number().min(0).max(1).default(0.3),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [embedding] = await embedBatch([data.query]);
    const { data: matches, error } = await supabase.rpc("match_kb_chunks", {
      query_embedding: toPgVector(embedding),
      match_count: data.topK,
      similarity_threshold: data.threshold,
    });
    if (error) throw new Error(error.message);
    return { matches: matches ?? [] };
  });

// Internal helper used by ai.functions.ts to enrich prompts.
// Returns a context block + citation metadata, or null if disabled / no matches.
export async function retrieveKbContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  query: string,
  opts: { topK?: number; threshold?: number } = {},
): Promise<{ block: string; citations: Citation[] } | null> {
  try {
    // Check global toggle
    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "kb")
      .maybeSingle();
    const enabled = (setting?.value as { enabled?: boolean } | null)?.enabled ?? true;
    if (!enabled) return null;

    const q = query.slice(0, 2000).trim();
    if (!q) return null;

    const [embedding] = await embedBatch([q]);
    const { data: matches } = await supabase.rpc("match_kb_chunks", {
      query_embedding: toPgVector(embedding),
      match_count: opts.topK ?? 5,
      similarity_threshold: opts.threshold ?? 0.4,
    });
    const rows = (matches ?? []) as Array<{
      id: string;
      document_id: string;
      chunk_index: number;
      content: string;
      similarity: number;
      title: string;
      category: string;
      source: string | null;
    }>;
    if (rows.length === 0) return null;

    const citations: Citation[] = rows.map((r, i) => ({
      index: i + 1,
      chunkId: r.id,
      documentId: r.document_id,
      title: r.title,
      category: r.category,
      source: r.source,
      similarity: Number(r.similarity.toFixed(3)),
      snippet: r.content.slice(0, 240),
    }));

    const block = rows
      .map((r, i) => `[${i + 1}] ${r.title}${r.source ? ` (${r.source})` : ""}\n${r.content}`)
      .join("\n\n---\n\n");

    return { block, citations };
  } catch (e) {
    console.error("retrieveKbContext failed:", e);
    return null;
  }
}

export type Citation = {
  index: number;
  chunkId: string;
  documentId: string;
  title: string;
  category: string;
  source: string | null;
  similarity: number;
  snippet: string;
};
