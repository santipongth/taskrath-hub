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

export type ResearchDoc = {
  url: string;
  title: string;
  snippet: string;
  markdown: string;
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

async function firecrawlSearch(query: string, limit: number, lang: string): Promise<ResearchDoc[]> {
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

async function firecrawlScrape(url: string): Promise<ResearchDoc> {
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

const docSchema = z.object({
  url: z.string(),
  title: z.string(),
  snippet: z.string(),
  markdown: z.string().max(20_000),
});

/** Step 1: create the run row, gather sources, and stream per-step progress via realtime. */
export const prepareResearchSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        question: z.string().trim().min(5).max(2000),
        limit: z.number().int().min(3).max(10).optional(),
        depth: z.enum(["fast", "deep"]).optional().default("fast"),
        lang: z.enum(["th", "en"]).optional().default("th"),
        urls: z.array(z.string().url()).max(8).optional().default([]),
        hasAttachments: z.boolean().optional().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const guard = checkPromptInjection(data.question);
    if (guard.decision === "block") throw new Error("คำถามมีรูปแบบที่ไม่อนุญาต (prompt injection)");

    const effectiveLimit = data.limit ?? (data.depth === "deep" ? 10 : 4);
    const urls = (data.urls ?? []).filter(Boolean);
    const useProvided = urls.length > 0 || data.hasAttachments;
    const mode = useProvided ? ("provided" as const) : ("search" as const);

    // Create run row up front so the UI can subscribe to realtime progress.
    const { data: runRow, error: insertErr } = await supabase
      .from("ai_runs")
      .insert({
        user_id: userId,
        template_id: "deep-research",
        title: data.question.slice(0, 120),
        input: { question: data.question, lang: data.lang, urls, hasAttachments: data.hasAttachments },
        status: "running",
        metadata: {
          kind: "deep_research",
          step: "gather",
          step_label_th: useProvided
            ? `กำลังดึงเนื้อหาจาก ${urls.length} ลิงก์…`
            : `กำลังค้นเว็บ (สูงสุด ${effectiveLimit} แหล่ง)…`,
          step_label_en: useProvided
            ? `Fetching ${urls.length} link(s)…`
            : `Searching the web (up to ${effectiveLimit} sources)…`,
          step_progress: 15,
          depth: data.depth,
          limit: effectiveLimit,
          mode,
        },
      })
      .select("id")
      .single();
    if (insertErr) throw new Error(insertErr.message);
    const runId = runRow.id as string;

    let docs: ResearchDoc[] = [];
    const failed: string[] = [];

    try {
      if (urls.length > 0) {
        const results = await Promise.allSettled(urls.map((u) => firecrawlScrape(u)));
        results.forEach((r, i) => {
          if (r.status === "fulfilled") docs.push(r.value);
          else failed.push(urls[i]);
        });
      }

      if (!useProvided) {
        docs = await firecrawlSearch(data.question, effectiveLimit, data.lang);
        if (docs.length === 0) throw new Error("ไม่พบแหล่งข้อมูล กรุณาลองคำถามใหม่");
      } else if (docs.length === 0 && !data.hasAttachments) {
        throw new Error("ดึงข้อมูลจาก URL ที่ระบุไม่สำเร็จ");
      }

      const sources: ResearchSource[] = docs.map((d, i) => ({
        n: i + 1, title: d.title, url: d.url, snippet: d.snippet,
      }));

      // Gather done → advance to synthesize step (realtime UPDATE).
      await supabase
        .from("ai_runs")
        .update({
          metadata: {
            kind: "deep_research",
            step: "synthesize",
            step_label_th: `กำลังสรุปจาก ${sources.length} แหล่ง…`,
            step_label_en: `Synthesizing from ${sources.length} sources…`,
            step_progress: 55,
            depth: data.depth,
            limit: effectiveLimit,
            mode,
            sources,
            failed,
          },
        })
        .eq("id", runId);

      return { runId, sources, docs, failed, mode, depth: data.depth, limit: effectiveLimit };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gather failed";
      await supabase
        .from("ai_runs")
        .update({
          status: "failed",
          metadata: {
            kind: "deep_research",
            step: "error",
            step_label_th: `ดึงแหล่งข้อมูลล้มเหลว: ${msg}`,
            step_label_en: `Gather failed: ${msg}`,
            step_progress: 0,
            depth: data.depth,
            limit: effectiveLimit,
            mode,
            failed,
          },
        })
        .eq("id", runId);
      throw err;
    }
  });

/** Step 2: synthesize report from prepared docs (+ optional file attachments). */
export const synthesizeResearchReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        runId: z.string().uuid(),
        question: z.string().trim().min(5).max(2000),
        lang: z.enum(["th", "en"]).optional().default("th"),
        docs: z.array(docSchema).max(10),
        attachments: z.array(attachmentSchema).max(6).optional().default([]),
        mode: z.enum(["search", "provided"]).optional().default("search"),
        depth: z.enum(["fast", "deep"]).optional().default("fast"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ResearchResult> => {
    const { supabase, userId } = context;
    const atts = (data.attachments ?? []) as AttachmentInput[];
    const docs = data.docs;

    const sources: ResearchSource[] = docs.map((d, i) => ({
      n: i + 1, title: d.title, url: d.url, snippet: d.snippet,
    }));

    // Verify caller owns the run row.
    const { data: existing, error: ownErr } = await supabase
      .from("ai_runs").select("id, user_id").eq("id", data.runId).single();
    if (ownErr || !existing || existing.user_id !== userId) {
      throw new Error("ไม่พบหรือไม่มีสิทธิ์เข้าถึง run นี้");
    }

    // Realtime: mark synthesis active.
    await supabase
      .from("ai_runs")
      .update({
        metadata: {
          kind: "deep_research",
          step: "synthesize",
          step_label_th: `กำลังเรียบเรียงรายงาน${atts.length ? ` + ${atts.length} ไฟล์แนบ` : ""}…`,
          step_label_en: `Drafting report${atts.length ? ` with ${atts.length} attachment(s)` : ""}…`,
          step_progress: 70,
          depth: data.depth,
          limit: docs.length,
          mode: data.mode,
          sources,
        },
      })
      .eq("id", data.runId);

    try {
      const contextBlock = docs
        .map((d, i) => `[${i + 1}] ${d.title}\nURL: ${d.url}\n\n${d.markdown || d.snippet}`)
        .join("\n\n---\n\n") || (data.lang === "th" ? "(ไม่มีแหล่ง URL — ใช้ไฟล์แนบเป็นหลัก)" : "(no URL sources — use attachments)");

      const memBlock = await loadUserMemoryBlock(supabase, userId);
      const depthDirective =
        data.depth === "deep"
          ? (data.lang === "th"
              ? "\n\nโหมด: เชิงลึก — วิเคราะห์ละเอียด เปรียบเทียบมุมมองจากหลายแหล่ง ระบุข้อขัดแย้ง/ข้อจำกัด และเสนอข้อเสนอแนะเชิงนโยบาย ความยาวประมาณ 800–1200 คำ"
              : "\n\nMode: Deep — produce a thorough analysis, contrast viewpoints across sources, surface conflicts/limitations, and add policy-style recommendations. Target 800–1200 words.")
          : (data.lang === "th"
              ? "\n\nโหมด: เร็ว — สรุปกระชับ เน้นประเด็นสำคัญและข้อค้นพบหลัก ความยาวประมาณ 300–500 คำ"
              : "\n\nMode: Fast — concise summary focusing on key points and main findings. Target 300–500 words.");

      const systemPrompt =
        (data.lang === "th"
          ? "คุณเป็นนักวิเคราะห์ราชการไทย จงเขียนรายงานสรุปจากแหล่งข้อมูลและไฟล์แนบที่ให้มา ใช้ภาษาทางการ จัดหัวข้อชัดเจน อ้างอิงด้วยเลขในวงเล็บ [n] ทุกข้อความที่อ้างจากแหล่ง สำหรับไฟล์แนบให้ระบุ [ไฟล์: ชื่อไฟล์] ห้ามแต่งข้อมูลที่ไม่มีในแหล่ง"
          : "You are a research analyst. Write a clear report from the provided sources and attachments. Cite every factual claim using [n] for URLs or [file: name] for attachments. Do not invent information.") +
        depthDirective +
        memBlock;

      const userPrompt =
        (data.lang === "th" ? "คำถามวิจัย:\n" : "Research question:\n") + data.question + "\n\n" +
        (data.lang === "th" ? "แหล่งข้อมูล:\n" : "Sources:\n") + contextBlock + "\n\n" +
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

      const { error } = await supabase
        .from("ai_runs")
        .update({
          input: { question: data.question, lang: data.lang, sources: sources.map((s) => s.url), attachments: atts.map((a) => ({ name: a.name, kind: a.kind })) },
          output: report,
          status: "completed",
          prompt_tokens: ai.usage.promptTokens,
          completion_tokens: ai.usage.completionTokens,
          cost_usd: ai.usage.costUsd,
          metadata: {
            kind: "deep_research",
            step: "done",
            step_label_th: "เสร็จสิ้น",
            step_label_en: "Complete",
            step_progress: 100,
            sources,
            mode: data.mode,
            depth: data.depth,
          },
        })
        .eq("id", data.runId);
      if (error) throw new Error(error.message);

      await supabase.rpc("log_audit", {
        p_action: "research.run",
        p_resource: data.runId,
        p_metadata: { sources: sources.length, attachments: atts.length, mode: data.mode, depth: data.depth, usage: ai.usage } as never,
      });

      return { runId: data.runId, report, sources, usage: ai.usage };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Synthesis failed";
      await supabase
        .from("ai_runs")
        .update({
          status: "failed",
          metadata: {
            kind: "deep_research",
            step: "error",
            step_label_th: `สังเคราะห์รายงานล้มเหลว: ${msg}`,
            step_label_en: `Synthesis failed: ${msg}`,
            step_progress: 0,
            sources,
            mode: data.mode,
            depth: data.depth,
          },
        })
        .eq("id", data.runId);
      throw err;
    }
  });
