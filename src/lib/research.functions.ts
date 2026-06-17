import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkPromptInjection } from "@/lib/prompt-guard";
import { callAI } from "@/lib/ai.functions";
import { loadUserMemoryBlock } from "@/lib/user-memory.functions";

export type ResearchSource = {
  n: number;
  title: string;
  url: string;
  snippet: string;
};

export type ResearchResult = {
  runId: string;
  report: string;
  sources: ResearchSource[];
  usage: { promptTokens: number; completionTokens: number; costUsd: number };
};

const FIRECRAWL = "https://api.firecrawl.dev/v2";

async function firecrawlSearch(query: string, limit: number, lang: string) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("ยังไม่ได้เชื่อมต่อ Firecrawl");
  const res = await fetch(`${FIRECRAWL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      query,
      limit,
      lang: lang === "th" ? "th" : "en",
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Firecrawl search ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    data?: { web?: Array<{ url: string; title?: string; description?: string; markdown?: string }> } | Array<{
      url: string;
      title?: string;
      description?: string;
      markdown?: string;
    }>;
  };
  const raw = json.data;
  const list = Array.isArray(raw) ? raw : (raw?.web ?? []);
  return list
    .filter((r) => !!r?.url)
    .slice(0, limit)
    .map((r) => ({
      url: r.url,
      title: r.title ?? r.url,
      snippet: (r.description ?? "").slice(0, 240),
      markdown: (r.markdown ?? "").slice(0, 8000),
    }));
}

export const runDeepResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        question: z.string().trim().min(5).max(2000),
        limit: z.number().int().min(3).max(10).optional().default(6),
        lang: z.enum(["th", "en"]).optional().default("th"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ResearchResult> => {
    const { supabase, userId } = context;

    const guard = checkPromptInjection(data.question);
    if (guard.decision === "block") {
      throw new Error("คำถามมีรูปแบบที่ไม่อนุญาต (prompt injection)");
    }

    const docs = await firecrawlSearch(data.question, data.limit, data.lang);
    if (docs.length === 0) {
      throw new Error("ไม่พบแหล่งข้อมูล กรุณาลองคำถามใหม่");
    }

    const sources: ResearchSource[] = docs.map((d, i) => ({
      n: i + 1,
      title: d.title,
      url: d.url,
      snippet: d.snippet,
    }));

    const contextBlock = docs
      .map(
        (d, i) =>
          `[${i + 1}] ${d.title}\nURL: ${d.url}\n\n${d.markdown || d.snippet}`,
      )
      .join("\n\n---\n\n");

    const memBlock = await loadUserMemoryBlock(supabase, userId);
    const systemPrompt =
      (data.lang === "th"
        ? "คุณเป็นนักวิเคราะห์ราชการไทย จงเขียนรายงานสรุปจากแหล่งข้อมูลที่ให้มา ใช้ภาษาทางการ จัดหัวข้อชัดเจน อ้างอิงด้วยเลขในวงเล็บ [n] ทุกข้อความที่อ้างจากแหล่ง ห้ามแต่งข้อมูลที่ไม่มีในแหล่ง หากแหล่งขัดแย้งให้บันทึกไว้"
        : "You are a research analyst. Write a clear report from the provided sources, using formal tone and clear sections. Cite every factual claim using [n] referring to source numbers. Do not invent information not in the sources.") +
      memBlock;

    const userPrompt =
      (data.lang === "th" ? "คำถามวิจัย:\n" : "Research question:\n") +
      data.question +
      "\n\n" +
      (data.lang === "th" ? "แหล่งข้อมูล:\n" : "Sources:\n") +
      contextBlock +
      "\n\n" +
      (data.lang === "th"
        ? "เขียนรายงาน Markdown มีหัวข้อ: บทสรุปผู้บริหาร, ประเด็นสำคัญ, ข้อค้นพบ (อ้างอิง [n]), ข้อจำกัด, แหล่งอ้างอิง (เรียงตามเลข)."
        : "Write a Markdown report with sections: Executive summary, Key points, Findings (cite [n]), Limitations, References (numbered).");

    const ai = await callAI(systemPrompt, userPrompt);

    const refsList = sources.map((s) => `[${s.n}] ${s.title} — ${s.url}`).join("\n");
    const report = ai.text + "\n\n---\n" + (data.lang === "th" ? "แหล่งอ้างอิง:\n" : "References:\n") + refsList;

    const { data: run, error } = await supabase
      .from("ai_runs")
      .insert({
        user_id: userId,
        template_id: "deep-research",
        title: data.question.slice(0, 120),
        input: { question: data.question, limit: data.limit, lang: data.lang },
        output: report,
        status: "completed",
        prompt_tokens: ai.usage.promptTokens,
        completion_tokens: ai.usage.completionTokens,
        cost_usd: ai.usage.costUsd,
        metadata: { kind: "deep_research", sources },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supabase.rpc("log_audit", {
      p_action: "research.run",
      p_resource: run.id,
      p_metadata: { sources: sources.length, usage: ai.usage } as never,
    });

    return { runId: run.id as string, report, sources, usage: ai.usage };
  });
