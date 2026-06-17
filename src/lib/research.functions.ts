import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkPromptInjection } from "@/lib/prompt-guard";
import { callAI, callAIMultimodal, attachmentSchema, type AttachmentInput } from "@/lib/ai.functions";
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

function fcKey() {
  const k = process.env.FIRECRAWL_API_KEY;
  if (!k) throw new Error("ยังไม่ได้เชื่อมต่อ Firecrawl");
  return k;
}

async function firecrawlSearch(query: string, limit: number, lang: string) {
  const res = await fetch(`${FIRECRAWL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${fcKey()}` },
    body: JSON.stringify({
      query, limit,
      lang: lang === "th" ? "th" : "en",
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
  });
  if (!res.ok) throw new Error(`Firecrawl search ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as {
    data?: { web?: Array<{ url: string; title?: string; description?: string; markdown?: string }> } | Array<{
      url: string; title?: string; description?: string; markdown?: string;
    }>;
  };
  const raw = json.data;
  const list = Array.isArray(raw) ? raw : (raw?.web ?? []);
  return list.filter((r) => !!r?.url).slice(0, limit).map((r) => ({
    url: r.url, title: r.title ?? r.url,
    snippet: (r.description ?? "").slice(0, 240),
    markdown: (r.markdown ?? "").slice(0, 8000),
  }));
}

async function firecrawlScrape(url: string) {
  const res = await fetch(`${FIRECRAWL}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${fcKey()}` },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });
  if (!res.ok) throw new Error(`Firecrawl scrape ${url} ${res.status}`);
  const json = (await res.json()) as {
    data?: { markdown?: string; metadata?: { title?: string; description?: string; sourceURL?: string } };
    markdown?: string;
    metadata?: { title?: string; description?: string; sourceURL?: string };
  };
  const d = json.data ?? json;
  return {
    url: d.metadata?.sourceURL ?? url,
    title: d.metadata?.title ?? url,
    snippet: (d.metadata?.description ?? "").slice(0, 240),
    markdown: (d.markdown ?? "").slice(0, 8000),
  };
}

export const runDeepResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        question: z.string().trim().min(5).max(2000),
        limit: z.number().int().min(3).max(10).optional().default(6),
        lang: z.enum(["th", "en"]).optional().default("th"),
        urls: z.array(z.string().url()).max(8).optional().default([]),
        attachments: z.array(attachmentSchema).max(6).optional().default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ResearchResult> => {
    const { supabase, userId } = context;

    const guard = checkPromptInjection(data.question);
    if (guard.decision === "block") {
      throw new Error("คำถามมีรูปแบบที่ไม่อนุญาต (prompt injection)");
    }

    const urls = (data.urls ?? []).filter(Boolean);
    const atts = (data.attachments ?? []) as AttachmentInput[];
    const useProvided = urls.length > 0 || atts.length > 0;

    type Doc = { url: string; title: string; snippet: string; markdown: string };
    let docs: Doc[] = [];

    if (urls.length > 0) {
      const scraped = await Promise.allSettled(urls.map((u) => firecrawlScrape(u)));
      for (const s of scraped) {
        if (s.status === "fulfilled") docs.push(s.value);
      }
    }

    if (!useProvided) {
      docs = await firecrawlSearch(data.question, data.limit, data.lang);
      if (docs.length === 0) throw new Error("ไม่พบแหล่งข้อมูล กรุณาลองคำถามใหม่");
    } else if (docs.length === 0 && atts.length === 0) {
      throw new Error("ดึงข้อมูลจาก URL ที่ระบุไม่สำเร็จ");
    }

    const sources: ResearchSource[] = docs.map((d, i) => ({
      n: i + 1, title: d.title, url: d.url, snippet: d.snippet,
    }));

    const contextBlock = docs
      .map((d, i) => `[${i + 1}] ${d.title}\nURL: ${d.url}\n\n${d.markdown || d.snippet}`)
      .join("\n\n---\n\n") || (data.lang === "th" ? "(ไม่มีแหล่ง URL — ใช้ไฟล์แนบเป็นหลัก)" : "(no URL sources — use attachments)");

    const memBlock = await loadUserMemoryBlock(supabase, userId);
    const systemPrompt =
      (data.lang === "th"
        ? "คุณเป็นนักวิเคราะห์ราชการไทย จงเขียนรายงานสรุปจากแหล่งข้อมูลและไฟล์แนบที่ให้มา ใช้ภาษาทางการ จัดหัวข้อชัดเจน อ้างอิงด้วยเลขในวงเล็บ [n] ทุกข้อความที่อ้างจากแหล่ง สำหรับไฟล์แนบให้ระบุ [ไฟล์: ชื่อไฟล์] ห้ามแต่งข้อมูลที่ไม่มีในแหล่ง หากแหล่งขัดแย้งให้บันทึกไว้"
        : "You are a research analyst. Write a clear report from the provided sources and attachments. Cite every factual claim using [n] for URLs or [file: name] for attachments. Do not invent information.") +
      memBlock;

    const userPrompt =
      (data.lang === "th" ? "คำถามวิจัย:\n" : "Research question:\n") +
      data.question +
      "\n\n" +
      (data.lang === "th" ? "แหล่งข้อมูล:\n" : "Sources:\n") +
      contextBlock +
      "\n\n" +
      (data.lang === "th"
        ? "เขียนรายงาน Markdown มีหัวข้อ: บทสรุปผู้บริหาร, ประเด็นสำคัญ, ข้อค้นพบ (อ้างอิง), ข้อจำกัด, แหล่งอ้างอิง."
        : "Write a Markdown report with sections: Executive summary, Key points, Findings (cited), Limitations, References.");

    const ai = atts.length > 0
      ? await callAIMultimodal(systemPrompt, userPrompt, atts)
      : await callAI(systemPrompt, userPrompt);

    const refsList = sources.length > 0
      ? sources.map((s) => `[${s.n}] ${s.title} — ${s.url}`).join("\n")
      : (data.lang === "th" ? "(ไม่มีแหล่ง URL)" : "(no URL sources)");
    const attRefs = atts.length > 0
      ? "\n" + (data.lang === "th" ? "ไฟล์แนบ:\n" : "Attachments:\n") + atts.map((a) => `- ${a.name}`).join("\n")
      : "";
    const report = ai.text + "\n\n---\n" + (data.lang === "th" ? "แหล่งอ้างอิง:\n" : "References:\n") + refsList + attRefs;

    const { data: run, error } = await supabase
      .from("ai_runs")
      .insert({
        user_id: userId,
        template_id: "deep-research",
        title: data.question.slice(0, 120),
        input: { question: data.question, limit: data.limit, lang: data.lang, urls, attachments: atts.map((a) => ({ name: a.name, kind: a.kind })) },
        output: report,
        status: "completed",
        prompt_tokens: ai.usage.promptTokens,
        completion_tokens: ai.usage.completionTokens,
        cost_usd: ai.usage.costUsd,
        metadata: { kind: "deep_research", sources, mode: useProvided ? "provided" : "search" },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supabase.rpc("log_audit", {
      p_action: "research.run",
      p_resource: run.id,
      p_metadata: { sources: sources.length, attachments: atts.length, mode: useProvided ? "provided" : "search", usage: ai.usage } as never,
    });

    return { runId: run.id as string, report, sources, usage: ai.usage };
  });
