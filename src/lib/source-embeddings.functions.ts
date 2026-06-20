import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAI } from "@/lib/ai.functions";

const EMBED_MODEL = "openai/text-embedding-3-small";
const EMBED_DIMS = 1536;
const CHUNK_CHARS = 1200;
const CHUNK_OVERLAP = 150;

function chunkText(text: string, size = CHUNK_CHARS, overlap = CHUNK_OVERLAP): string[] {
  const clean = text.replace(/\s+\n/g, "\n").trim();
  if (clean.length <= size) return clean ? [clean] : [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    chunks.push(clean.slice(i, i + size));
    i += size - overlap;
  }
  return chunks;
}

async function embedBatch(inputs: string[]): Promise<number[][]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI service not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs, dimensions: EMBED_DIMS }),
  });
  if (res.status === 429) throw new Error("Rate limit exceeded.");
  if (res.status === 402) throw new Error("AI credits exhausted.");
  if (!res.ok) throw new Error(`Embedding error ${res.status}: ${await res.text().catch(() => "")}`);
  const json = (await res.json()) as { data: Array<{ embedding: number[]; index: number }> };
  return json.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

export const embedSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ source_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: src, error } = await supabase
      .from("project_sources")
      .select("id, project_id, title, url, content_md")
      .eq("id", data.source_id)
      .eq("user_id", userId)
      .single();
    if (error || !src) throw new Error("Source not found");

    const text = [src.title, src.url, src.content_md ?? ""].filter(Boolean).join("\n\n");
    const chunks = chunkText(text);
    if (chunks.length === 0) return { chunks: 0 };

    // delete old rows
    await supabase.from("source_embeddings").delete().eq("source_id", src.id).eq("user_id", userId);

    // batch in groups of 32
    const all: number[][] = [];
    for (let i = 0; i < chunks.length; i += 32) {
      const part = await embedBatch(chunks.slice(i, i + 32));
      all.push(...part);
    }

    const rows = chunks.map((content, idx) => ({
      user_id: userId,
      project_id: src.project_id,
      source_id: src.id,
      chunk_index: idx,
      content,
      embedding: all[idx] as unknown as string,
    }));
    const { error: insErr } = await supabase.from("source_embeddings").insert(rows);
    if (insErr) throw new Error(insErr.message);
    return { chunks: chunks.length };
  });

export const reindexProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ project_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: srcs, error } = await supabase
      .from("project_sources")
      .select("id")
      .eq("user_id", userId)
      .eq("project_id", data.project_id);
    if (error) throw new Error(error.message);
    let total = 0;
    for (const s of srcs ?? []) {
      const { data: src } = await supabase
        .from("project_sources")
        .select("id, project_id, title, url, content_md")
        .eq("id", s.id)
        .single();
      if (!src) continue;
      const text = [src.title, src.url, src.content_md ?? ""].filter(Boolean).join("\n\n");
      const chunks = chunkText(text);
      if (chunks.length === 0) continue;
      await supabase.from("source_embeddings").delete().eq("source_id", src.id).eq("user_id", userId);
      const all: number[][] = [];
      for (let i = 0; i < chunks.length; i += 32) {
        const part = await embedBatch(chunks.slice(i, i + 32));
        all.push(...part);
      }
      const rows = chunks.map((content, idx) => ({
        user_id: userId,
        project_id: src.project_id,
        source_id: src.id,
        chunk_index: idx,
        content,
        embedding: all[idx] as unknown as string,
      }));
      const { error: insErr } = await supabase.from("source_embeddings").insert(rows);
      if (insErr) throw new Error(insErr.message);
      total += chunks.length;
    }
    return { sources: srcs?.length ?? 0, chunks: total };
  });

export type AskCitation = {
  source_id: string;
  title: string;
  url: string | null;
  similarity: number;
};

export const askProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        project_id: z.string().uuid(),
        question: z.string().trim().min(3).max(2000),
        k: z.number().int().min(1).max(12).optional().default(6),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [qVec] = await embedBatch([data.question]);

    const { data: matches, error } = await supabase.rpc("match_source_chunks", {
      query_embedding: qVec as unknown as string,
      p_project_id: data.project_id,
      match_count: data.k,
      similarity_threshold: 0.25,
    });
    if (error) throw new Error(error.message);

    type Match = {
      source_id: string;
      chunk_index: number;
      content: string;
      similarity: number;
      title: string;
      url: string | null;
    };
    const rows = (matches ?? []) as Match[];
    if (rows.length === 0) {
      return {
        answer:
          "ไม่พบข้อมูลที่ใกล้เคียงคำถามนี้ในแหล่งข้อมูลของ Notebook นี้ — ลองเพิ่มแหล่งหรือ Re-index ก่อนนะครับ",
        citations: [] as AskCitation[],
      };
    }

    // Dedup citations per source (keep best similarity)
    const bySource = new Map<string, AskCitation>();
    rows.forEach((r) => {
      const existing = bySource.get(r.source_id);
      if (!existing || r.similarity > existing.similarity) {
        bySource.set(r.source_id, {
          source_id: r.source_id,
          title: r.title,
          url: r.url,
          similarity: r.similarity,
        });
      }
    });
    const citations = Array.from(bySource.values()).sort((a, b) => b.similarity - a.similarity);

    // Build numbered context
    const sourceIndex = new Map<string, number>();
    citations.forEach((c, i) => sourceIndex.set(c.source_id, i + 1));

    const contextBlock = rows
      .map((r) => `[${sourceIndex.get(r.source_id)}] (${r.title})\n${r.content}`)
      .join("\n\n---\n\n");

    const system =
      "คุณเป็นผู้ช่วย AI สำหรับเจ้าหน้าที่หน่วยงานไทย ตอบเป็นภาษาไทยที่กระชับ ตรงประเด็น " +
      "ใช้เฉพาะข้อมูลจาก <แหล่ง> ที่ให้เท่านั้น ถ้าไม่พบให้บอกตรง ๆ ห้ามแต่งเติม " +
      "เมื่อใช้ข้อมูลให้อ้างอิงท้ายประโยคในรูปแบบ [หมายเลข] ตามที่ระบุไว้ในแหล่ง";
    const userPrompt = `คำถาม: ${data.question}\n\n<แหล่ง>\n${contextBlock}\n</แหล่ง>`;
    const { text } = await callAI(system, userPrompt);

    return { answer: text, citations };
  });
