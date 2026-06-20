import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAI } from "@/lib/ai.functions";

const EMBED_MODEL = "openai/text-embedding-3-small";
const EMBED_DIMS = 1536;

async function embedOne(text: string): Promise<number[]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI service not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: [text], dimensions: EMBED_DIMS }),
  });
  if (res.status === 429) throw new Error("Rate limit exceeded.");
  if (res.status === 402) throw new Error("AI credits exhausted.");
  if (!res.ok) throw new Error(`Embedding error ${res.status}`);
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data[0].embedding;
}

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type ChatSnippet = {
  chunk_index: number;
  content: string;
  similarity: number;
  answer_overlap: number;
};
export type ChatCitation = {
  source_id: string;
  title: string;
  url: string | null;
  kind: string | null;
  similarity: number;
  snippets: ChatSnippet[];
};

// Cheap token overlap (Jaccard) used to rank a snippet against the final answer.
function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[`*_>#~\-=()\[\]{}.,;:!?"'“”‘’]/g, " ")
      .split(/\s+/u)
      .filter((w) => w.length >= 2),
  );
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export const askProjectChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        project_id: z.string().uuid(),
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().max(8000),
            }),
          )
          .min(1)
          .max(30),
        k: z.number().int().min(1).max(12).optional().default(6),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const last = data.messages[data.messages.length - 1];
    if (last.role !== "user") throw new Error("last message must be from user");

    const recentUserTurns = data.messages
      .filter((m) => m.role === "user")
      .slice(-2)
      .map((m) => m.content)
      .join("\n");
    const qVec = await embedOne(recentUserTurns);

    const { data: matches, error } = await supabase.rpc("match_source_chunks", {
      query_embedding: qVec as unknown as string,
      p_project_id: data.project_id,
      match_count: data.k,
      similarity_threshold: 0.22,
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

    // Group raw snippets by source (we'll re-rank after we have the answer)
    type RawSnippet = { chunk_index: number; content: string; similarity: number };
    const rawBySource = new Map<
      string,
      { title: string; url: string | null; snippets: RawSnippet[] }
    >();
    rows.forEach((r) => {
      const entry = rawBySource.get(r.source_id);
      const snippet: RawSnippet = {
        chunk_index: r.chunk_index,
        content: r.content,
        similarity: r.similarity,
      };
      if (entry) {
        entry.snippets.push(snippet);
      } else {
        rawBySource.set(r.source_id, {
          title: r.title,
          url: r.url,
          snippets: [snippet],
        });
      }
    });

    // Fetch kind metadata for the cited sources
    const ids = Array.from(rawBySource.keys());
    const kindById = new Map<string, string>();
    if (ids.length > 0) {
      const { data: srcRows } = await supabase
        .from("project_sources")
        .select("id, kind")
        .in("id", ids);
      (srcRows ?? []).forEach((s: { id: string; kind: string }) =>
        kindById.set(s.id, s.kind),
      );
    }

    // Build numbered citation list (pre-answer ordering by best chunk similarity)
    const preCitations = Array.from(rawBySource.entries())
      .map(([source_id, v]) => ({
        source_id,
        title: v.title,
        url: v.url,
        kind: kindById.get(source_id) ?? null,
        similarity: Math.max(...v.snippets.map((s) => s.similarity)),
        snippets: v.snippets,
      }))
      .sort((a, b) => b.similarity - a.similarity);

    const sourceIndex = new Map<string, number>();
    preCitations.forEach((c, i) => sourceIndex.set(c.source_id, i + 1));

    const contextBlock = rows.length
      ? rows
          .map((r) => `[${sourceIndex.get(r.source_id)}] (${r.title})\n${r.content}`)
          .join("\n\n---\n\n")
      : "(ไม่มีเนื้อหาที่เกี่ยวข้องในแหล่งข้อมูล)";

    const history = data.messages
      .slice(0, -1)
      .map((m) => `${m.role === "user" ? "ผู้ใช้" : "ผู้ช่วย"}: ${m.content}`)
      .join("\n\n");

    const system =
      "คุณเป็นผู้ช่วย AI สำหรับเจ้าหน้าที่หน่วยงานไทย ตอบเป็นภาษาไทยที่กระชับ ตรงประเด็น " +
      "ใช้เฉพาะข้อมูลจาก <แหล่ง> ที่ให้เท่านั้นเป็นข้อเท็จจริง หากไม่พบให้บอกตรง ๆ ห้ามแต่งเติม " +
      "เมื่ออ้างอิงข้อเท็จจริงต้องใส่ [หมายเลข] ท้ายประโยคหรือวลีทุกครั้ง ตามที่ระบุในแหล่ง " +
      "(เช่น [1], [2]) เพื่อให้ผู้อ่านคลิกตรวจสอบได้ " +
      "อ่านประวัติบทสนทนาก่อนหน้าเพื่อความต่อเนื่อง";

    const userPrompt =
      (history ? `<ประวัติบทสนทนา>\n${history}\n</ประวัติบทสนทนา>\n\n` : "") +
      `<แหล่ง>\n${contextBlock}\n</แหล่ง>\n\nคำถามล่าสุด: ${last.content}`;

    const { text: answer } = await callAI(system, userPrompt);

    // Re-rank snippets against the produced answer so the "most representative"
    // excerpt for each citation comes first in the UI.
    const answerTokens = tokenize(answer);
    const citations: ChatCitation[] = preCitations.map((c) => {
      const scored: ChatSnippet[] = c.snippets
        .map((s) => {
          const overlap = jaccard(answerTokens, tokenize(s.content));
          return {
            chunk_index: s.chunk_index,
            content: s.content,
            similarity: s.similarity,
            answer_overlap: overlap,
          };
        })
        .sort(
          (a, b) =>
            // 60% answer-overlap, 40% retrieval similarity
            0.6 * b.answer_overlap + 0.4 * b.similarity -
            (0.6 * a.answer_overlap + 0.4 * a.similarity),
        );
      return {
        source_id: c.source_id,
        title: c.title,
        url: c.url,
        kind: c.kind,
        similarity: c.similarity,
        snippets: scored,
      };
    });

    return { answer, citations };
  });
