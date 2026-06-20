import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_BYTES = 15 * 1024 * 1024; // 15MB upload cap

type ChatContent =
  | { type: "text"; text: string }
  | { type: "file"; file: { filename: string; file_data: string } }
  | { type: "input_audio"; input_audio: { data: string; format: string } };

async function gatewayChat(
  model: string,
  system: string,
  userContent: ChatContent[],
): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI service not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
    }),
  });
  if (res.status === 429) throw new Error("Rate limit exceeded. ลองใหม่อีกครั้งภายหลัง");
  if (res.status === 402) throw new Error("AI credits exhausted. กรุณาเติม credits");
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI extraction failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const j = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = j.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("AI returned empty content");
  return text;
}

function detectKind(mime: string, filename: string): "pdf" | "audio" | "text" | "unknown" {
  const m = mime.toLowerCase();
  const n = filename.toLowerCase();
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (m.startsWith("audio/") || /\.(mp3|wav|m4a|webm|ogg|aac|flac)$/.test(n)) return "audio";
  if (m.startsWith("text/") || /\.(txt|md|csv|json)$/.test(n)) return "text";
  return "unknown";
}

function audioFormat(mime: string, filename: string): string {
  const m = mime.toLowerCase();
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4") || m.includes("m4a")) return "m4a";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("aac")) return "aac";
  if (m.includes("flac")) return "flac";
  const n = filename.toLowerCase();
  const ext = n.split(".").pop() ?? "mp3";
  return ext;
}

export const uploadSourceFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        project_id: z.string().uuid(),
        filename: z.string().trim().min(1).max(300),
        mime: z.string().max(120),
        // base64 (no data: prefix)
        base64: z.string().min(8),
        title: z.string().trim().max(200).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Size check (approx from base64 length)
    const approxBytes = Math.floor((data.base64.length * 3) / 4);
    if (approxBytes > MAX_BYTES) {
      throw new Error(`ไฟล์ใหญ่เกินไป (สูงสุด ${Math.round(MAX_BYTES / 1024 / 1024)} MB)`);
    }

    const kind = detectKind(data.mime, data.filename);
    if (kind === "unknown") {
      throw new Error("รองรับเฉพาะไฟล์ PDF, เสียง (mp3/wav/m4a/webm), และข้อความ");
    }

    // 1) Upload to storage under user's folder
    const safeName = data.filename.replace(/[^\w.\-]+/g, "_").slice(0, 200);
    const storagePath = `${userId}/${data.project_id}/${Date.now()}_${safeName}`;
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const { error: upErr } = await supabase.storage
      .from("notebook-files")
      .upload(storagePath, bytes, {
        contentType: data.mime || "application/octet-stream",
        upsert: false,
      });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    // 2) Extract text
    let extracted = "";
    try {
      if (kind === "pdf") {
        extracted = await gatewayChat(
          "google/gemini-2.5-flash",
          "You are a precise document text extractor. Output only the readable text from the document, preserving paragraph breaks and headings. Do not add commentary.",
          [
            { type: "text", text: "Extract all readable text from this PDF (preserve structure)." },
            {
              type: "file",
              file: {
                filename: data.filename,
                file_data: `data:${data.mime || "application/pdf"};base64,${data.base64}`,
              },
            },
          ],
        );
      } else if (kind === "audio") {
        extracted = await gatewayChat(
          "google/gemini-2.5-flash",
          "You are an accurate transcription engine. Output only the verbatim transcript in the original language (Thai or English). No commentary.",
          [
            { type: "text", text: "Transcribe this audio verbatim." },
            { type: "input_audio", input_audio: { data: data.base64, format: audioFormat(data.mime, data.filename) } },
          ],
        );
      } else {
        // text
        extracted = new TextDecoder().decode(bytes).slice(0, 200_000);
      }
    } catch (e) {
      // Roll back storage if extraction fails
      await supabase.storage.from("notebook-files").remove([storagePath]).catch(() => {});
      throw e instanceof Error ? e : new Error("Extraction failed");
    }

    extracted = extracted.slice(0, 200_000);

    // 3) Insert project_source
    const title = (data.title?.trim() || data.filename).slice(0, 200);
    const { data: row, error: insErr } = await supabase
      .from("project_sources")
      .insert({
        user_id: userId,
        project_id: data.project_id,
        kind: "file",
        title,
        url: null,
        file_path: storagePath,
        content_md: extracted,
        metadata: { mime: data.mime, bytes: approxBytes, source_kind: kind } as never,
      })
      .select("id")
      .single();
    if (insErr || !row) {
      await supabase.storage.from("notebook-files").remove([storagePath]).catch(() => {});
      throw new Error(insErr?.message ?? "Insert failed");
    }

    return { id: row.id as string, chars: extracted.length, kind };
  });
