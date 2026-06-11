import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { retrieveKbContext, type Citation } from "@/lib/kb.functions";
import { redactPII } from "@/lib/pii";

// ───────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────

export type ChatThread = {
  id: string;
  title: string;
  category_filter: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  thread_id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  created_at: string;
};

// ───────────────────────────────────────────────────────────
// Thread CRUD
// ───────────────────────────────────────────────────────────

export const listChatThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("chat_threads")
      .select("id, title, category_filter, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { threads: (data ?? []) as ChatThread[] };
  });

export const createChatThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().min(1).max(200).optional(),
        categoryFilter: z.enum(["regulation", "circular", "manual", "law", "other"]).nullable().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("chat_threads")
      .insert({
        user_id: userId,
        title: data.title ?? "สนทนาใหม่",
        category_filter: data.categoryFilter ?? null,
      })
      .select("id, title, category_filter, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return { thread: row as ChatThread };
  });

export const renameChatThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), title: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("chat_threads").update({ title: data.title }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteChatThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("chat_threads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getChatThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: thread, error: e1 } = await supabase
      .from("chat_threads")
      .select("id, title, category_filter, created_at, updated_at")
      .eq("id", data.id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!thread) throw new Error("ไม่พบห้องสนทนา");

    const { data: msgs, error: e2 } = await supabase
      .from("chat_messages")
      .select("id, thread_id, role, content, citations, created_at")
      .eq("thread_id", data.id)
      .order("created_at", { ascending: true });
    if (e2) throw new Error(e2.message);

    return {
      thread: thread as ChatThread,
      messages: (msgs ?? []) as ChatMessage[],
    };
  });

// ───────────────────────────────────────────────────────────
// Send message (RAG + LLM)
// ───────────────────────────────────────────────────────────

const CHAT_MODEL = "google/gemini-2.5-flash";

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        threadId: z.string().uuid(),
        message: z.string().min(1).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI service not configured");

    // 1. Verify thread ownership (RLS handles this, but fetch to also get history)
    const { data: thread, error: eT } = await supabase
      .from("chat_threads")
      .select("id, title, category_filter")
      .eq("id", data.threadId)
      .maybeSingle();
    if (eT) throw new Error(eT.message);
    if (!thread) throw new Error("ไม่พบห้องสนทนา");

    // 2. Load conversation history
    const { data: history, error: eH } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (eH) throw new Error(eH.message);

    // 3. PII-redact + persist user message
    const userClean = redactPII(data.message).text;
    const { error: eIns } = await supabase.from("chat_messages").insert({
      thread_id: data.threadId,
      user_id: userId,
      role: "user",
      content: data.message,
      citations: [],
    });
    if (eIns) throw new Error(eIns.message);

    // 4. RAG retrieval
    const rag = await retrieveKbContext(supabase, userClean, { topK: 5, threshold: 0.35 });
    const citations: Citation[] = rag?.citations ?? [];

    const systemPrompt = [
      "คุณคือผู้ช่วย AI สำหรับเจ้าหน้าที่ภาครัฐไทย เชี่ยวชาญด้านกฎระเบียบ หนังสือเวียน และระเบียบสารบรรณราชการ",
      "ตอบเป็นภาษาไทยที่กระชับ เป็นทางการ",
      "ใช้ Markdown ในการจัดรูปแบบ (หัวข้อ, รายการ) เมื่อช่วยให้อ่านง่ายขึ้น",
      rag
        ? [
            "ใช้ context ด้านล่างเป็นแหล่งอ้างอิงหลัก หากไม่พบคำตอบใน context ให้แจ้งว่า \"ไม่พบในเอกสารอ้างอิงของระบบ\" อย่างชัดเจน",
            "เมื่ออ้างอิงข้อมูล ให้ใส่หมายเลข [1] [2] ตามลำดับ context",
            "",
            "===== CONTEXT =====",
            rag.block,
            "===== END CONTEXT =====",
          ].join("\n")
        : "หมายเหตุ: ไม่พบเอกสารใน Knowledge Base ที่เกี่ยวข้องกับคำถามนี้ — แจ้งผู้ใช้และตอบตามความรู้ทั่วไปอย่างระมัดระวัง",
    ].join("\n\n");

    const messages = [
      { role: "system", content: systemPrompt },
      ...((history ?? []) as { role: string; content: string }[]).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: userClean },
    ];

    // 5. Call Lovable AI Gateway
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: CHAT_MODEL, messages, temperature: 0.3 }),
    });
    if (res.status === 429) throw new Error("ใช้งานเกินขีดจำกัด กรุณาลองใหม่ในอีกสักครู่");
    if (res.status === 402) throw new Error("เครดิต AI หมด กรุณาเติมเครดิตในการตั้งค่า workspace");
    if (!res.ok) throw new Error(`AI error ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const reply: string = json.choices?.[0]?.message?.content ?? "(ไม่มีคำตอบ)";

    // 6. Persist assistant message
    const { data: assistantRow, error: eAs } = await supabase
      .from("chat_messages")
      .insert({
        thread_id: data.threadId,
        user_id: userId,
        role: "assistant",
        content: reply,
        citations: citations as unknown as never,
      })
      .select("id, thread_id, role, content, citations, created_at")
      .single();
    if (eAs) throw new Error(eAs.message);

    // 7. Auto-title from first user msg (if still default)
    if (thread.title === "สนทนาใหม่" && (history?.length ?? 0) === 0) {
      const title = data.message.slice(0, 60).replace(/\s+/g, " ").trim() || "สนทนาใหม่";
      await supabase.from("chat_threads").update({ title }).eq("id", data.threadId);
    } else {
      // Touch updated_at
      await supabase.from("chat_threads").update({ title: thread.title }).eq("id", data.threadId);
    }

    return { message: assistantRow as ChatMessage };
  });
