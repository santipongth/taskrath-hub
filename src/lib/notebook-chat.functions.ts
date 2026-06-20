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
export type ChatCitation = {
  source_id: string;
  title: string;
  url: string | null;
  similarity: number;
};

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

    // Use last 2 user turns combined as the retrieval query for better recall
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

    const bySource = new Map<string, ChatCitation>();
    rows.forEach((r) => {
      const ex = bySource.get(r.source_id);
      if (!ex || r.similarity > ex.similarity) {
        bySource.set(r.source_id, {
          source_id: r.source_id,
          title: r.title,
          url: r.url,
          similarity: r.similarity,
        });
      }
    });
    const citations = Array.from(bySource.values()).sort((a, b) => b.similarity - a.similarity);

    const sourceIndex = new Map<string, number>();
    citations.forEach((c, i) => sourceIndex.set(c.source_id, i + 1));

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
      "เมื่ออ้างอิงข้อมูลให้ใส่ [หมายเลข] ท้ายประโยค ตามที่ระบุในแหล่ง " +
      "อ่านประวัติบทสนทนาก่อนหน้าเพื่อความต่อเนื่อง";

    const userPrompt =
      (history ? `<ประวัติบทสนทนา>\n${history}\n</ประวัติบทสนทนา>\n\n` : "") +
      `<แหล่ง>\n${contextBlock}\n</แหล่ง>\n\nคำถามล่าสุด: ${last.content}`;

    const { text } = await callAI(system, userPrompt);

    return { answer: text, citations };
  });
