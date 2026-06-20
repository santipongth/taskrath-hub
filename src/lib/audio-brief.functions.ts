import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAI } from "@/lib/ai.functions";

const TTS_MODEL = "openai/gpt-4o-mini-tts";
const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"] as const;

async function ttsToMp3(text: string, voice: string, speed: number): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI service not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: TTS_MODEL,
      input: text,
      voice,
      speed,
      response_format: "mp3",
    }),
  });
  if (res.status === 429) throw new Error("Rate limit exceeded.");
  if (res.status === 402) throw new Error("AI credits exhausted.");
  if (!res.ok) throw new Error(`TTS error ${res.status}: ${await res.text().catch(() => "")}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString("base64");
}

function chunkForTTS(text: string, maxChars = 1800): string[] {
  if (text.length <= maxChars) return [text];
  const parts: string[] = [];
  const sentences = text.match(/[^.!?\n。!?]+[.!?\n。!?]*/g) ?? [text];
  let cur = "";
  for (const s of sentences) {
    if (cur.length + s.length > maxChars && cur) {
      parts.push(cur);
      cur = "";
    }
    cur += s;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

export const generateAudioBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        project_id: z.string().uuid(),
        voice: z.enum(VOICES).optional().default("alloy"),
        style: z.enum(["brief", "podcast"]).optional().default("brief"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: project }, { data: sources }, { data: notes }] = await Promise.all([
      supabase.from("user_projects").select("name, context").eq("id", data.project_id).eq("user_id", userId).single(),
      supabase
        .from("project_sources")
        .select("title, url, content_md, kind")
        .eq("project_id", data.project_id)
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(20),
      supabase
        .from("project_notes")
        .select("title, content_md, origin")
        .eq("project_id", data.project_id)
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(10),
    ]);

    if (!project) throw new Error("Notebook not found");

    const sourceBlock = (sources ?? [])
      .map(
        (s, i) =>
          `[${i + 1}] ${s.title}${s.url ? ` (${s.url})` : ""}\n${(s.content_md ?? "").slice(0, 1500)}`,
      )
      .join("\n\n---\n\n");
    const noteBlock = (notes ?? [])
      .map((n) => `• ${n.title}\n${n.content_md.slice(0, 600)}`)
      .join("\n\n");

    if (!sourceBlock && !noteBlock) {
      throw new Error("Notebook ว่างเปล่า — โปรดเพิ่มแหล่งข้อมูลหรือโน้ตอย่างน้อย 1 รายการ");
    }

    const styleHint =
      data.style === "podcast"
        ? "เขียนในสไตล์พอดแคสต์แบบเล่าเรื่องที่อบอุ่นเป็นกันเอง มีอินโทรเปิดและสรุปปิด ความยาวประมาณ 2–3 นาที (350–500 คำ)"
        : "เขียนเป็นบรีฟแบบกระชับ ตรงประเด็น น้ำเสียงทางการแต่อ่านง่าย ความยาวประมาณ 1–2 นาที (180–280 คำ)";

    const system =
      "คุณเป็นผู้ผลิตเนื้อหาเสียงภาษาไทย เขียนสคริปต์อ่านออกเสียงล้วน " +
      "ห้ามใส่หัวข้อ markdown หรือสัญลักษณ์พิเศษ ใช้คำเชื่อมที่อ่านลื่นหู " +
      "ไม่ต้องอ้างอิงหมายเลขแหล่ง ให้พูดเนื้อหาออกมาเป็นธรรมชาติ";
    const userPrompt =
      `Notebook: ${project.name}\n` +
      (project.context ? `บริบท: ${project.context}\n` : "") +
      `\n${styleHint}\n\n` +
      `<แหล่งข้อมูล>\n${sourceBlock || "(ไม่มี)"}\n</แหล่งข้อมูล>\n\n` +
      (noteBlock ? `<โน้ต>\n${noteBlock}\n</โน้ต>\n\n` : "") +
      "เขียนสคริปต์เสียงตอนนี้:";

    const { text: script } = await callAI(system, userPrompt);
    const clean = script.replace(/[#*_`>]+/g, "").trim();

    const chunks = chunkForTTS(clean);
    const audios: string[] = [];
    for (const c of chunks) {
      audios.push(await ttsToMp3(c, data.voice));
    }

    return { script: clean, audio_base64: audios, mime: "audio/mpeg", voice: data.voice };
  });

export const AUDIO_BRIEF_VOICES = VOICES;
