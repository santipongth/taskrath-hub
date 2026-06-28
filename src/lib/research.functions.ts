import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkPromptInjection } from "@/lib/prompt-guard";
import { callAI, callAIMultimodal, attachmentSchema, type AttachmentInput } from "@/lib/ai.functions";
import { loadUserMemoryBlock } from "@/lib/user-memory.functions";
import { loadSkillPrompt } from "@/lib/user-skills.functions";
import { loadSharedSkillPrompt } from "@/lib/shared-skills.functions";

export type ResearchSource = {
  n: number;
  title: string;
  url: string;
  snippet: string;
  /** 0..1 — how relevant the extractor agent rates this source vs. the question. */
  relevance?: number;
  /** Bullet-point findings extracted by the per-source agent. */
  keypoints?: string[];
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

export type Intensity = "fast" | "deep" | "custom";
export type ReportLength = "short" | "medium" | "long";

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
  relevance: z.number().min(0).max(1).optional(),
  keypoints: z.array(z.string().max(500)).max(8).optional(),
});

/** Extract a JSON object/array from an LLM reply that may include code fences. */
function parseJsonLoose<T = unknown>(text: string): T | null {
  if (!text) return null;
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  // Try whole-string first
  try { return JSON.parse(s) as T; } catch { /* fallthrough */ }
  // Try first {...} or [...]
  const objMatch = s.match(/\{[\s\S]*\}/);
  const arrMatch = s.match(/\[[\s\S]*\]/);
  const candidate = (objMatch && arrMatch)
    ? (objMatch.index! < arrMatch.index! ? objMatch[0] : arrMatch[0])
    : (objMatch?.[0] ?? arrMatch?.[0] ?? null);
  if (candidate) {
    try { return JSON.parse(candidate) as T; } catch { /* ignore */ }
  }
  return null;
}

function resolvePreset(
  intensity: Intensity,
  maxSources: number | undefined,
  reportLength: ReportLength | undefined,
) {
  if (intensity === "fast") return { limit: 4, length: "short" as ReportLength };
  if (intensity === "deep") return { limit: 10, length: "long" as ReportLength };
  // custom
  const limit = Math.min(Math.max(maxSources ?? 6, 3), 15);
  return { limit, length: (reportLength ?? "medium") as ReportLength };
}

function lengthDirective(len: ReportLength, lang: "th" | "en"): string {
  const map = {
    short: lang === "th" ? "ความยาวประมาณ 300–500 คำ" : "Target 300–500 words.",
    medium: lang === "th" ? "ความยาวประมาณ 500–800 คำ" : "Target 500–800 words.",
    long: lang === "th" ? "ความยาวประมาณ 1,000–1,500 คำ" : "Target 1,000–1,500 words.",
  };
  return map[len];
}

/** Planner agent — for deep/custom modes, propose 2-3 sub-queries that broaden coverage. */
async function plannerAgent(question: string, lang: "th" | "en", baseLimit: number) {
  const sys = lang === "th"
    ? "คุณเป็น 'Planner Agent' ของระบบวิจัยแบบหลายตัวแทน หน้าที่: แตกคำถามวิจัยเป็นคำค้นย่อย 2–3 ข้อ ที่ครอบคลุมมุมมองที่ต่างกัน (เช่น นโยบาย/กฎหมาย/ผลกระทบ/กรณีศึกษา) ตอบเป็น JSON เท่านั้น"
    : "You are the 'Planner Agent' of a multi-agent research system. Decompose the research question into 2–3 complementary sub-queries covering different angles (e.g. policy, legal, impact, case study). Respond with JSON only.";
  const user = `${lang === "th" ? "คำถาม" : "Question"}: ${question}\n${lang === "th" ? "โควต้าแหล่งทั้งหมด" : "Total source budget"}: ${baseLimit}\n${lang === "th" ? "คืนค่า" : "Return"}: {"subQueries": ["...", "..."]}`;
  try {
    const r = await callAI(sys, user);
    const parsed = parseJsonLoose<{ subQueries?: string[] }>(r.text);
    const subs = (parsed?.subQueries ?? [])
      .filter((s): s is string => typeof s === "string" && s.trim().length > 3)
      .slice(0, 3);
    return { subQueries: subs, usage: r.usage };
  } catch {
    return { subQueries: [] as string[], usage: { promptTokens: 0, completionTokens: 0, costUsd: 0 } };
  }
}

/** Per-source extractor agent — score relevance + extract key findings. */
async function extractorAgent(question: string, doc: ResearchDoc, lang: "th" | "en") {
  const sys = lang === "th"
    ? "คุณเป็น 'Extractor Agent' หน้าที่: อ่านเนื้อหาแหล่งเดียวและสรุปสิ่งที่เกี่ยวข้องกับคำถาม ประเมินคะแนนความเกี่ยวข้อง 0–1 (ทศนิยม 2 ตำแหน่ง) ตอบ JSON เท่านั้น"
    : "You are the 'Extractor Agent'. Read one source and summarize findings relevant to the question. Score relevance from 0–1 (2 decimals). Respond with JSON only.";
  const content = (doc.markdown || doc.snippet || "").slice(0, 6000);
  const user = `${lang === "th" ? "คำถาม" : "Question"}: ${question}\nURL: ${doc.url}\nTitle: ${doc.title}\n\n${content}\n\n${lang === "th" ? "คืน" : "Return"}: {"relevance": 0.0, "keypoints": ["...","..."], "summary": "..."}`;
  try {
    const r = await callAI(sys, user);
    const parsed = parseJsonLoose<{ relevance?: number; keypoints?: string[]; summary?: string }>(r.text);
    const relevance = typeof parsed?.relevance === "number" ? Math.max(0, Math.min(1, parsed.relevance)) : 0.5;
    const keypoints = Array.isArray(parsed?.keypoints)
      ? parsed!.keypoints.filter((k): k is string => typeof k === "string").slice(0, 6)
      : [];
    const summary = typeof parsed?.summary === "string" ? parsed!.summary.slice(0, 1200) : "";
    return { relevance, keypoints, summary, usage: r.usage };
  } catch {
    return { relevance: 0.5, keypoints: [] as string[], summary: "", usage: { promptTokens: 0, completionTokens: 0, costUsd: 0 } };
  }
}

const intensityEnum = z.enum(["fast", "deep", "custom"]);
const lengthEnum = z.enum(["short", "medium", "long"]);

/** Step 1: create the run row, run planner (if applicable), gather sources, emit realtime progress. */
export const prepareResearchSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        question: z.string().trim().min(5).max(2000),
        intensity: intensityEnum.optional().default("fast"),
        maxSources: z.number().int().min(3).max(15).optional(),
        reportLength: lengthEnum.optional(),
        // Back-compat: clients may still send `depth` and `limit`.
        depth: z.enum(["fast", "deep"]).optional(),
        limit: z.number().int().min(3).max(15).optional(),
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

    const intensity: Intensity = data.intensity ?? (data.depth as Intensity | undefined) ?? "fast";
    const preset = resolvePreset(intensity, data.maxSources ?? data.limit, data.reportLength);
    const effectiveLimit = preset.limit;
    const reportLength = preset.length;

    const urls = (data.urls ?? []).filter(Boolean);
    const useProvided = urls.length > 0 || data.hasAttachments;
    const mode = useProvided ? ("provided" as const) : ("search" as const);
    const runPlanner = !useProvided && (intensity === "deep" || intensity === "custom") && effectiveLimit >= 5;

    // Create run row up front so the UI can subscribe to realtime progress.
    const initialStep = runPlanner ? "plan" : "gather";
    const { data: runRow, error: insertErr } = await supabase
      .from("ai_runs")
      .insert({
        user_id: userId,
        template_id: "deep-research",
        title: data.question.slice(0, 120),
        input: { question: data.question, lang: data.lang, urls, hasAttachments: data.hasAttachments, intensity, maxSources: effectiveLimit, reportLength },
        status: "running",
        metadata: {
          kind: "deep_research",
          step: initialStep,
          step_label_th: runPlanner
            ? "Planner Agent กำลังวางแผนคำค้น…"
            : useProvided
              ? `กำลังดึงเนื้อหาจาก ${urls.length} ลิงก์…`
              : `กำลังค้นเว็บ (สูงสุด ${effectiveLimit} แหล่ง)…`,
          step_label_en: runPlanner
            ? "Planner agent decomposing the question…"
            : useProvided
              ? `Fetching ${urls.length} link(s)…`
              : `Searching the web (up to ${effectiveLimit} sources)…`,
          step_progress: runPlanner ? 8 : 15,
          intensity,
          depth: intensity === "custom" ? "custom" : intensity, // back-compat for history page
          limit: effectiveLimit,
          reportLength,
          mode,
        },
      })
      .select("id")
      .single();
    if (insertErr) throw new Error(insertErr.message);
    const runId = runRow.id as string;

    let docs: ResearchDoc[] = [];
    const failed: string[] = [];
    let plannerSubQueries: string[] = [];

    try {
      // --- Planner agent (deep/custom + web search) ---
      if (runPlanner) {
        const plan = await plannerAgent(data.question, data.lang, effectiveLimit);
        plannerSubQueries = plan.subQueries;
        await supabase.from("ai_runs").update({
          metadata: {
            kind: "deep_research", step: "gather",
            step_label_th: plannerSubQueries.length
              ? `Planner เสร็จ — ค้น ${plannerSubQueries.length + 1} ชุดคำค้น…`
              : `กำลังค้นเว็บ (สูงสุด ${effectiveLimit} แหล่ง)…`,
            step_label_en: plannerSubQueries.length
              ? `Planner done — searching ${plannerSubQueries.length + 1} query sets…`
              : `Searching the web (up to ${effectiveLimit} sources)…`,
            step_progress: 22,
            intensity, depth: intensity === "custom" ? "custom" : intensity,
            limit: effectiveLimit, reportLength, mode, plan: plannerSubQueries,
          },
        }).eq("id", runId);
      }

      // --- Gather sources ---
      if (urls.length > 0) {
        const results = await Promise.allSettled(urls.map((u) => firecrawlScrape(u)));
        results.forEach((r, i) => {
          if (r.status === "fulfilled") docs.push(r.value);
          else failed.push(urls[i]);
        });
      }

      if (!useProvided) {
        const queries = [data.question, ...plannerSubQueries];
        const perQuery = Math.max(2, Math.ceil(effectiveLimit / queries.length));
        const fetched = await Promise.allSettled(
          queries.map((q) => firecrawlSearch(q, perQuery, data.lang)),
        );
        const seen = new Set<string>();
        for (const res of fetched) {
          if (res.status !== "fulfilled") continue;
          for (const d of res.value) {
            if (seen.has(d.url)) continue;
            seen.add(d.url);
            docs.push(d);
            if (docs.length >= effectiveLimit) break;
          }
          if (docs.length >= effectiveLimit) break;
        }
        if (docs.length === 0) throw new Error("ไม่พบแหล่งข้อมูล กรุณาลองคำถามใหม่");
      } else if (docs.length === 0 && !data.hasAttachments) {
        throw new Error("ดึงข้อมูลจาก URL ที่ระบุไม่สำเร็จ");
      }

      // --- Extractor agents (per-source relevance + key points) ---
      const wantExtract = !useProvided || intensity !== "fast"; // skip for tiny fast+provided
      if (wantExtract && docs.length > 0) {
        await supabase.from("ai_runs").update({
          metadata: {
            kind: "deep_research", step: "extract",
            step_label_th: `Extractor Agent กำลังประเมินความเกี่ยวข้องของ ${docs.length} แหล่ง…`,
            step_label_en: `Extractor agents scoring ${docs.length} sources…`,
            step_progress: 45,
            intensity, depth: intensity === "custom" ? "custom" : intensity,
            limit: effectiveLimit, reportLength, mode, plan: plannerSubQueries,
          },
        }).eq("id", runId);

        const extracted = await Promise.allSettled(docs.map((d) => extractorAgent(data.question, d, data.lang)));
        docs = docs.map((d, i) => {
          const r = extracted[i];
          if (r.status === "fulfilled") {
            return {
              ...d,
              relevance: r.value.relevance,
              keypoints: r.value.keypoints,
              // Replace markdown with extractor summary if it's substantial — saves tokens for synth
              markdown: r.value.summary && r.value.summary.length > 150 ? r.value.summary : d.markdown,
            } as ResearchDoc & { relevance: number; keypoints: string[] };
          }
          return d;
        });
        // Sort by relevance desc; cap to effectiveLimit
        docs.sort((a, b) => ((b as ResearchDoc & { relevance?: number }).relevance ?? 0) - ((a as ResearchDoc & { relevance?: number }).relevance ?? 0));
        docs = docs.slice(0, effectiveLimit);
      }

      const sources: ResearchSource[] = docs.map((d, i) => {
        const enriched = d as ResearchDoc & { relevance?: number; keypoints?: string[] };
        return {
          n: i + 1, title: d.title, url: d.url, snippet: d.snippet,
          relevance: enriched.relevance,
          keypoints: enriched.keypoints,
        };
      });

      await supabase
        .from("ai_runs")
        .update({
          metadata: {
            kind: "deep_research",
            step: "synthesize",
            step_label_th: `Synthesizer Agent กำลังสรุปจาก ${sources.length} แหล่ง…`,
            step_label_en: `Synthesizer agent drafting from ${sources.length} sources…`,
            step_progress: 65,
            intensity,
            depth: intensity === "custom" ? "custom" : intensity,
            limit: effectiveLimit,
            reportLength,
            mode,
            sources,
            failed,
            plan: plannerSubQueries,
          },
        })
        .eq("id", runId);

      return { runId, sources, docs, failed, mode, intensity, depth: intensity === "custom" ? "custom" : intensity, limit: effectiveLimit, reportLength, plan: plannerSubQueries };
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
            intensity,
            depth: intensity === "custom" ? "custom" : intensity,
            limit: effectiveLimit,
            reportLength,
            mode,
            failed,
          },
        })
        .eq("id", runId);
      throw err;
    }
  });

/** Step 2: synthesizer agent — final cited report (with optional user skill prompt). */
export const synthesizeResearchReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        runId: z.string().uuid(),
        question: z.string().trim().min(5).max(2000),
        lang: z.enum(["th", "en"]).optional().default("th"),
        docs: z.array(docSchema).max(15),
        attachments: z.array(attachmentSchema).max(6).optional().default([]),
        mode: z.enum(["search", "provided"]).optional().default("search"),
        intensity: intensityEnum.optional().default("fast"),
        reportLength: lengthEnum.optional(),
        skillId: z.string().uuid().optional().nullable(),
        personalSkillId: z.string().uuid().optional().nullable(),
        sharedSkillId: z.string().uuid().optional().nullable(),
        // back-compat
        depth: z.enum(["fast", "deep"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ResearchResult> => {
    const { supabase, userId } = context;
    const atts = (data.attachments ?? []) as AttachmentInput[];
    const docs = data.docs;
    const intensity: Intensity = data.intensity ?? (data.depth as Intensity | undefined) ?? "fast";
    const preset = resolvePreset(intensity, docs.length, data.reportLength);
    const reportLength = preset.length;

    const sources: ResearchSource[] = docs.map((d, i) => ({
      n: i + 1, title: d.title, url: d.url, snippet: d.snippet,
      relevance: d.relevance,
      keypoints: d.keypoints,
    }));

    const { data: existing, error: ownErr } = await supabase
      .from("ai_runs").select("id, user_id").eq("id", data.runId).single();
    if (ownErr || !existing || existing.user_id !== userId) {
      throw new Error("ไม่พบหรือไม่มีสิทธิ์เข้าถึง run นี้");
    }

    await supabase
      .from("ai_runs")
      .update({
        metadata: {
          kind: "deep_research",
          step: "synthesize",
          step_label_th: `Synthesizer Agent กำลังเรียบเรียงรายงาน${atts.length ? ` + ${atts.length} ไฟล์แนบ` : ""}…`,
          step_label_en: `Synthesizer drafting report${atts.length ? ` with ${atts.length} attachment(s)` : ""}…`,
          step_progress: 80,
          intensity,
          depth: intensity === "custom" ? "custom" : intensity,
          limit: docs.length,
          reportLength,
          mode: data.mode,
          sources,
        },
      })
      .eq("id", data.runId);

    try {
      const contextBlock = docs
        .map((d, i) => {
          const kp = d.keypoints && d.keypoints.length > 0
            ? `\n${data.lang === "th" ? "ประเด็นจาก Extractor" : "Extractor key points"}:\n- ${d.keypoints.join("\n- ")}`
            : "";
          const rel = typeof d.relevance === "number" ? ` · relevance=${d.relevance.toFixed(2)}` : "";
          return `[${i + 1}] ${d.title}${rel}\nURL: ${d.url}${kp}\n\n${d.markdown || d.snippet}`;
        })
        .join("\n\n---\n\n") || (data.lang === "th" ? "(ไม่มีแหล่ง URL — ใช้ไฟล์แนบเป็นหลัก)" : "(no URL sources — use attachments)");

      const memBlock = await loadUserMemoryBlock(supabase, userId);
      const personalSkillId = data.personalSkillId ?? data.skillId ?? null;
      const [skillBlock, sharedSkillBlock] = await Promise.all([
        loadSkillPrompt(supabase, userId, personalSkillId),
        loadSharedSkillPrompt(supabase, userId, data.sharedSkillId ?? null),
      ]);

      const intensityDirective =
        intensity === "deep"
          ? (data.lang === "th"
              ? "\n\nโหมด: เชิงลึก (multi-agent) — วิเคราะห์ละเอียด เปรียบเทียบมุมมองข้ามแหล่ง ระบุข้อขัดแย้ง/ข้อจำกัด และเสนอข้อเสนอแนะเชิงนโยบาย"
              : "\n\nMode: Deep (multi-agent) — thorough analysis, cross-source comparison, surface conflicts/limitations, add policy recommendations.")
          : intensity === "custom"
            ? (data.lang === "th"
                ? "\n\nโหมด: กำหนดเอง — ปรับน้ำหนักการวิเคราะห์ตามจำนวนแหล่งและความยาวที่ผู้ใช้กำหนด"
                : "\n\nMode: Custom — adapt analysis depth to user-defined source count and length.")
            : (data.lang === "th"
                ? "\n\nโหมด: เร็ว — สรุปกระชับ เน้นประเด็นสำคัญและข้อค้นพบหลัก"
                : "\n\nMode: Fast — concise summary focusing on key points and main findings.");

      const systemPrompt =
        (data.lang === "th"
          ? "คุณเป็น 'Synthesizer Agent' (นักวิเคราะห์ราชการไทย) ของระบบวิจัยแบบหลายตัวแทน จงเขียนรายงานสรุปจากแหล่งข้อมูลและไฟล์แนบที่ Extractor Agent คัดมาให้ ใช้ภาษาทางการ จัดหัวข้อชัดเจน อ้างอิงด้วยเลข [n] ทุกข้อความที่อ้างจากแหล่ง สำหรับไฟล์แนบให้ระบุ [ไฟล์: ชื่อไฟล์] ห้ามแต่งข้อมูลที่ไม่มีในแหล่ง"
          : "You are the 'Synthesizer Agent' of a multi-agent research system. Write a clear report using sources curated by the Extractor Agent and attachments. Cite every factual claim with [n] for URLs or [file: name] for attachments. Do not invent information.") +
        intensityDirective + " " + lengthDirective(reportLength, data.lang) +
        sharedSkillBlock + skillBlock + memBlock;

      const userPrompt =
        (data.lang === "th" ? "คำถามวิจัย:\n" : "Research question:\n") + data.question + "\n\n" +
        (data.lang === "th" ? "แหล่งข้อมูล (เรียงตามคะแนนความเกี่ยวข้อง):\n" : "Sources (ranked by relevance):\n") + contextBlock + "\n\n" +
        (data.lang === "th"
          ? "เขียนรายงาน Markdown มีหัวข้อ: บทสรุปผู้บริหาร, ประเด็นสำคัญ, ข้อค้นพบ (อ้างอิง), ข้อจำกัด, แหล่งอ้างอิง."
          : "Write a Markdown report with sections: Executive summary, Key points, Findings (cited), Limitations, References.");

      const ai = atts.length > 0
        ? await callAIMultimodal(systemPrompt, userPrompt, atts)
        : await callAI(systemPrompt, userPrompt);

      const refsList = sources.length > 0
        ? sources.map((s) => {
            const rel = typeof s.relevance === "number" ? ` (relevance ${(s.relevance * 100).toFixed(0)}%)` : "";
            return `[${s.n}] ${s.title}${rel} — ${s.url}`;
          }).join("\n")
        : (data.lang === "th" ? "(ไม่มีแหล่ง URL)" : "(no URL sources)");
      const attRefs = atts.length > 0
        ? "\n" + (data.lang === "th" ? "ไฟล์แนบ:\n" : "Attachments:\n") + atts.map((a) => `- ${a.name}`).join("\n")
        : "";
      const report = ai.text + "\n\n---\n" + (data.lang === "th" ? "แหล่งอ้างอิง:\n" : "References:\n") + refsList + attRefs;

      const { error } = await supabase
        .from("ai_runs")
        .update({
          input: { question: data.question, lang: data.lang, sources: sources.map((s) => s.url), attachments: atts.map((a) => ({ name: a.name, kind: a.kind })), intensity, reportLength, skillId: data.skillId ?? null },
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
            intensity,
            depth: intensity === "custom" ? "custom" : intensity,
            reportLength,
            limit: docs.length,
          },
        })
        .eq("id", data.runId);
      if (error) throw new Error(error.message);

      await supabase.rpc("log_audit", {
        p_action: "research.run",
        p_resource: data.runId,
        p_metadata: { sources: sources.length, attachments: atts.length, mode: data.mode, intensity, reportLength, usage: ai.usage } as never,
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
            intensity,
            depth: intensity === "custom" ? "custom" : intensity,
            reportLength,
          },
        })
        .eq("id", data.runId);
      throw err;
    }
  });
