import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAI } from "@/lib/ai.functions";
import { chunkText, sourceFullText } from "@/lib/chunker";

export type Transformation = {
  id: string;
  name: string;
  description: string | null;
  prompt: string;
  icon: string | null;
  is_default: boolean;
  sort_order: number;
};

const DEFAULT_TRANSFORMATIONS: Array<Omit<Transformation, "id">> = [
  {
    name: "สรุปเป็น Bullet",
    description: "สรุปประเด็นสำคัญเป็น bullet สั้น ๆ",
    prompt:
      "จงสรุปเนื้อหาด้านล่างเป็น bullet ภาษาไทย ไม่เกิน 7 ข้อ เน้นใจความสำคัญ ไม่แต่งเติม",
    icon: "list",
    is_default: true,
    sort_order: 10,
  },
  {
    name: "ดึงประเด็นสำคัญ (Key Insights)",
    description: "ดึง insight, ข้อสรุป, ตัวเลขสำคัญ",
    prompt:
      "จงสกัด Key Insights จากเนื้อหา โดยจัดหมวด: ข้อเท็จจริงสำคัญ / ตัวเลข-สถิติ / ข้อสรุป / สิ่งที่ควรติดตามต่อ",
    icon: "lightbulb",
    is_default: true,
    sort_order: 20,
  },
  {
    name: "สรุปสำหรับผู้บริหาร",
    description: "Executive summary 5-7 ประโยค ภาษาทางการ",
    prompt:
      "จงเขียน Executive Summary 5-7 ประโยค ภาษาราชการกระชับ ครอบคลุม: บริบท ประเด็นหลัก ผลกระทบ ข้อเสนอแนะ",
    icon: "briefcase",
    is_default: true,
    sort_order: 30,
  },
  {
    name: "ตั้งคำถาม Q&A",
    description: "สร้างคำถาม-คำตอบจากเนื้อหา",
    prompt:
      "จากเนื้อหา จงสร้าง 5-8 คำถามที่ผู้อ่านน่าสนใจถาม พร้อมคำตอบสั้น ๆ ในรูปแบบ Q: / A:",
    icon: "help-circle",
    is_default: true,
    sort_order: 40,
  },
  {
    name: "แปลเป็นอังกฤษ",
    description: "แปลเนื้อหาเป็นภาษาอังกฤษทางการ",
    prompt:
      "Translate the following content into formal English suitable for academic / official communication. Preserve names, numbers, and section structure.",
    icon: "languages",
    is_default: true,
    sort_order: 50,
  },
  {
    name: "ร่างโพสต์ประชาสัมพันธ์",
    description: "ดึงไฮไลต์มาเขียนเป็นโพสต์ PR",
    prompt:
      "จงเขียนโพสต์ประชาสัมพันธ์ภาษาไทย 1 โพสต์ ความยาว 3-5 บรรทัด เพื่อโพสต์บน Facebook ของหน่วยงาน โทนชวนอ่าน เป็นมิตร ลงท้ายด้วยลิงก์/ช่องทางติดต่อหากมี",
    icon: "megaphone",
    is_default: true,
    sort_order: 60,
  },
];

export const listMyTransformations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("transformations")
      .select("id, name, description, prompt, icon, is_default, sort_order")
      .eq("owner_id", userId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      // seed defaults
      const rows = DEFAULT_TRANSFORMATIONS.map((t) => ({ ...t, owner_id: userId }));
      const { data: inserted, error: insErr } = await supabase
        .from("transformations")
        .insert(rows)
        .select("id, name, description, prompt, icon, is_default, sort_order");
      if (insErr) throw new Error(insErr.message);
      return { transformations: (inserted ?? []) as Transformation[] };
    }
    return { transformations: data as Transformation[] };
  });

const upsertInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  prompt: z.string().trim().min(1).max(8000),
  icon: z.string().max(40).optional().nullable(),
  sort_order: z.number().int().min(0).max(9999).optional(),
});

export const upsertTransformation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => upsertInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      owner_id: userId,
      name: data.name,
      description: data.description ?? null,
      prompt: data.prompt,
      icon: data.icon ?? null,
      sort_order: data.sort_order ?? 100,
    };
    if (data.id) {
      const { error } = await supabase
        .from("transformations")
        .update(payload)
        .eq("id", data.id)
        .eq("owner_id", userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("transformations")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteTransformation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("transformations")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const applyTransformation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        transformation_id: z.string().uuid(),
        source_id: z.string().uuid(),
        save_as_note: z.boolean().optional().default(true),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: tf, error: tfErr } = await supabase
      .from("transformations")
      .select("id, name, prompt")
      .eq("id", data.transformation_id)
      .eq("owner_id", userId)
      .single();
    if (tfErr || !tf) throw new Error("Transformation not found");

    const { data: src, error: srcErr } = await supabase
      .from("project_sources")
      .select("id, project_id, title, url, content_md")
      .eq("id", data.source_id)
      .eq("user_id", userId)
      .single();
    if (srcErr || !src) throw new Error("Source not found");

    const body = [
      src.title ? `# ${src.title}` : null,
      src.url ? `URL: ${src.url}` : null,
      src.content_md ?? "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 60_000);

    if (!body.trim()) throw new Error("แหล่งนี้ไม่มีเนื้อหาให้ประมวลผล");

    const system =
      "คุณเป็นผู้ช่วย AI สำหรับเจ้าหน้าที่หน่วยงานไทย ตอบเป็นภาษาไทยกระชับ ตรงประเด็น และยึดข้อมูลจากเนื้อหาที่ให้เท่านั้น";
    const userPrompt = `${tf.prompt}\n\n---\n${body}`;
    const { text } = await callAI(system, userPrompt);

    let noteId: string | null = null;
    if (data.save_as_note) {
      const { data: note, error: nErr } = await supabase
        .from("project_notes")
        .insert({
          user_id: userId,
          project_id: src.project_id,
          source_id: src.id,
          title: `${tf.name} · ${src.title}`.slice(0, 200),
          content_md: text,
          origin: "transformation",
          metadata: { transformation_id: tf.id, transformation_name: tf.name } as never,
        })
        .select("id")
        .single();
      if (nErr) throw new Error(nErr.message);
      noteId = note.id as string;
    }

    return { output: text, note_id: noteId };
  });
