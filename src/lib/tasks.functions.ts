import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadUserMemoryBlock } from "@/lib/user-memory.functions";

export type Task = {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  type: string;
  priority: number;
  status: string;
  est_minutes: number | null;
  due_at: string | null;
  suggested_tool: SuggestedTool | null;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SuggestedTool = {
  kind: "template" | "skill" | "research" | "freeform" | "chat" | "external";
  ref?: string | null;
  label?: string;
  prefillPrompt?: string;
};

export type TaskEvent = {
  id: string;
  task_id: string;
  start_at: string;
  end_at: string;
  remind_at: string | null;
};

const TYPES = [
  "general",
  "document",
  "translation",
  "research",
  "pr",
  "presentation",
  "poster",
  "video",
  "coding",
  "email",
  "meeting",
  "data",
] as const;

const TASK_TYPE_LABEL: Record<string, string> = {
  general: "ทั่วไป",
  document: "เอกสาร/หนังสือราชการ",
  translation: "แปลภาษา",
  research: "ค้นข้อมูล/ทุน",
  pr: "ข่าว/PR",
  presentation: "พรีเซนต์เทชัน",
  poster: "โปสเตอร์/Infographic",
  video: "วิดีโอ",
  coding: "เขียนโค้ด",
  email: "อีเมล/ตอบเมล",
  meeting: "ประชุม",
  data: "วิเคราะห์ข้อมูล",
};

export function taskTypeLabel(t: string) {
  return TASK_TYPE_LABEL[t] ?? t;
}

// ---------- List / CRUD ----------

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("tasks")
      .select("id, project_id, title, description, type, priority, status, est_minutes, due_at, suggested_tool, sort_order, completed_at, created_at, updated_at")
      .eq("user_id", userId)
      .order("status", { ascending: true })
      .order("priority", { ascending: true })
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const tasks = (data ?? []) as unknown as Task[];
    const ids = tasks.map((t) => t.id);
    let events: TaskEvent[] = [];
    if (ids.length) {
      const { data: ev } = await supabase
        .from("task_events")
        .select("id, task_id, start_at, end_at, remind_at")
        .in("task_id", ids)
        .eq("user_id", userId);
      events = (ev ?? []) as TaskEvent[];
    }
    return { tasks, events };
  });

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(300).optional(),
        description: z.string().trim().max(4000).optional().nullable(),
        type: z.enum(TYPES).optional(),
        priority: z.number().int().min(1).max(3).optional(),
        status: z.enum(["inbox", "planned", "in_progress", "done", "blocked"]).optional(),
        est_minutes: z.number().int().min(1).max(60 * 24 * 7).optional().nullable(),
        due_at: z.string().datetime().optional().nullable(),
        project_id: z.string().uuid().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = {};
    for (const k of ["title", "description", "type", "priority", "status", "est_minutes", "due_at", "project_id"] as const) {
      const v = (data as Record<string, unknown>)[k];
      if (v !== undefined) patch[k] = v;
    }
    if (data.status === "done") patch.completed_at = new Date().toISOString();
    if (data.status && data.status !== "done") patch.completed_at = null;
    const { error } = await supabase
      .from("tasks")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createTaskManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(300),
        description: z.string().trim().max(4000).optional().nullable(),
        type: z.enum(TYPES).optional(),
        priority: z.number().int().min(1).max(3).optional(),
        est_minutes: z.number().int().min(1).max(60 * 24).optional().nullable(),
        due_at: z.string().datetime().optional().nullable(),
        project_id: z.string().uuid().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        title: data.title,
        description: data.description ?? null,
        type: data.type ?? "general",
        priority: data.priority ?? 2,
        est_minutes: data.est_minutes ?? null,
        due_at: data.due_at ?? null,
        project_id: data.project_id ?? null,
        status: "inbox",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

// ---------- Triage (AI break-down) ----------

const TRIAGE_SYSTEM = `คุณเป็น "Chief of Staff" ของเจ้าหน้าที่วิเทศสัมพันธ์มหาวิทยาลัย หน้าที่คือรับรายการงานที่ผู้ใช้พิมพ์/บอกมา (อาจปนกันหลายงาน ภาษาไทยและอังกฤษ) แล้วแตกออกเป็นงานย่อย ๆ ที่ "ทำได้จริงในขั้นตอนเดียว" พร้อมประเมินความสำคัญและแนะนำเครื่องมือที่เหมาะ

หลักการ:
- 1 task = 1 ผลลัพธ์ที่ตรวจสอบได้
- หากผู้ใช้ระบุ deadline ให้ดึงออกมาในรูป ISO 8601 (UTC). หากระบุเป็นภาษาธรรมชาติ (เช่น "พรุ่งนี้", "ศุกร์นี้") ให้คำนวณจากเวลาปัจจุบันที่ระบบส่งมา
- priority: 1=สูงมาก/ด่วน, 2=ปกติ, 3=ไม่เร่ง
- est_minutes: ประเมินเวลาที่ใช้จริงในการลงมือทำ (5-480)
- type เลือกจาก: ${TYPES.join(", ")}
- suggested_tool.kind เลือกจาก:
  - "template" = ใช้เทมเพลตสำเร็จรูป (หนังสือราชการ ฯลฯ) — ใส่ ref เป็น template id เช่น external-letter, meeting-summary, translate, announcement
  - "skill" = ใช้ skill ส่วนตัวของผู้ใช้ — ใส่ label เป็นชื่อ skill (จะ map ทีหลัง)
  - "research" = ค้นข้อมูล/ทุน/กฎหมาย ใช้หน้า Deep Research
  - "chat" = ถาม-ตอบกับ KB หลายเทิร์น
  - "freeform" = สั่งงาน AI อิสระ
  - "external" = ต้องทำเองนอกระบบ (เช่น ตัดต่อวิดีโอจริง, เซ็นเอกสารกระดาษ)
- prefillPrompt: ข้อความตั้งต้นที่ผู้ใช้กดไปทำต่อในเครื่องมือได้ทันที (ไม่ต้องยาวเกิน 400 ตัวอักษร)`;

type TriageResult = {
  title: string;
  description?: string;
  type: string;
  priority: number;
  est_minutes?: number;
  due_at?: string | null;
  suggested_tool?: SuggestedTool;
};

export const triageTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        text: z.string().trim().min(3).max(10000),
        project_id: z.string().uuid().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI service not configured");

    const memBlock = await loadUserMemoryBlock(supabase, userId);
    const now = new Date().toISOString();

    const userPrompt = `เวลาปัจจุบัน: ${now} (Asia/Bangkok)

รายการงานที่ผู้ใช้ส่งมา:
"""
${data.text}
"""

แตกเป็น tasks JSON ตาม schema ที่ระบุ`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: TRIAGE_SYSTEM + memBlock },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "task_breakdown",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["tasks"],
              properties: {
                tasks: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["title", "type", "priority"],
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      type: { type: "string", enum: [...TYPES] },
                      priority: { type: "integer", minimum: 1, maximum: 3 },
                      est_minutes: { type: "integer", minimum: 5, maximum: 480 },
                      due_at: { type: ["string", "null"] },
                      suggested_tool: {
                        type: "object",
                        additionalProperties: false,
                        required: ["kind"],
                        properties: {
                          kind: { type: "string", enum: ["template", "skill", "research", "chat", "freeform", "external"] },
                          ref: { type: ["string", "null"] },
                          label: { type: "string" },
                          prefillPrompt: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    });
    if (res.status === 429) throw new Error("AI ทำงานหนักเกินไป ลองอีกครั้งใน 1 นาที");
    if (res.status === 402) throw new Error("เครดิต AI หมด — เติมเครดิตที่ workspace settings");
    if (!res.ok) throw new Error(`Triage error ${res.status}`);
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { tasks: TriageResult[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("AI ตอบกลับในรูปแบบที่ไม่ถูกต้อง");
    }
    const items = (parsed.tasks ?? []).slice(0, 50);
    if (items.length === 0) return { inserted: 0, tasks: [] as Task[] };

    const batchId = crypto.randomUUID();
    const rows = items.map((t, i) => ({
      user_id: userId,
      project_id: data.project_id ?? null,
      title: t.title.slice(0, 300),
      description: t.description?.slice(0, 4000) ?? null,
      type: TYPES.includes(t.type as (typeof TYPES)[number]) ? t.type : "general",
      priority: Math.max(1, Math.min(3, Math.round(t.priority ?? 2))),
      est_minutes: t.est_minutes ?? null,
      due_at: t.due_at ?? null,
      suggested_tool: t.suggested_tool ?? null,
      source_batch_id: batchId,
      sort_order: i,
      status: "inbox",
    }));

    const { data: inserted, error } = await supabase
      .from("tasks")
      .insert(rows)
      .select("id, project_id, title, description, type, priority, status, est_minutes, due_at, suggested_tool, sort_order, completed_at, created_at, updated_at");
    if (error) throw new Error(error.message);
    return { inserted: rows.length, tasks: (inserted ?? []) as unknown as Task[] };
  });

// ---------- Planner (assign time blocks) ----------

export const planWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        start_hour: z.number().int().min(0).max(23).default(9),
        end_hour: z.number().int().min(1).max(24).default(17),
        days: z.number().int().min(1).max(7).default(5),
        replace: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rawTasks, error } = await supabase
      .from("tasks")
      .select("id, title, priority, est_minutes, due_at, status")
      .eq("user_id", userId)
      .in("status", ["inbox", "planned", "in_progress"]);
    if (error) throw new Error(error.message);
    const tasks = (rawTasks ?? []) as Array<{ id: string; title: string; priority: number; est_minutes: number | null; due_at: string | null; status: string }>;

    // Sort: due_at asc (null last), then priority asc
    tasks.sort((a, b) => {
      const da = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
      const db = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return a.priority - b.priority;
    });

    if (data.replace) {
      // Remove future planned events
      await supabase
        .from("task_events")
        .delete()
        .eq("user_id", userId)
        .gte("start_at", new Date().toISOString());
    }

    const now = new Date();
    // Snap to next slot >= max(now, today start_hour)
    const cursor = new Date(now);
    if (cursor.getHours() < data.start_hour) cursor.setHours(data.start_hour, 0, 0, 0);
    else cursor.setMinutes(Math.ceil(cursor.getMinutes() / 15) * 15, 0, 0);

    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + data.days);

    const events: Array<{ user_id: string; task_id: string; start_at: string; end_at: string; remind_at: string | null }> = [];

    function advanceCursorToWorkHours(c: Date) {
      while (true) {
        if (c >= horizon) return false;
        if (c.getHours() < data.start_hour) {
          c.setHours(data.start_hour, 0, 0, 0);
        }
        if (c.getHours() >= data.end_hour) {
          c.setDate(c.getDate() + 1);
          c.setHours(data.start_hour, 0, 0, 0);
          continue;
        }
        return true;
      }
    }

    for (const t of tasks) {
      const mins = t.est_minutes ?? 45;
      if (!advanceCursorToWorkHours(cursor)) break;
      // Don't cross end_hour boundary; if not enough room, jump to next day
      const endOfDay = new Date(cursor);
      endOfDay.setHours(data.end_hour, 0, 0, 0);
      let remaining = (endOfDay.getTime() - cursor.getTime()) / 60000;
      if (remaining < Math.min(mins, 30)) {
        cursor.setDate(cursor.getDate() + 1);
        cursor.setHours(data.start_hour, 0, 0, 0);
        if (!advanceCursorToWorkHours(cursor)) break;
        remaining = ((new Date(cursor).setHours(data.end_hour, 0, 0, 0)) - cursor.getTime()) / 60000;
      }
      const useMins = Math.min(mins, Math.max(30, remaining));
      const start = new Date(cursor);
      const end = new Date(cursor.getTime() + useMins * 60000);
      const remind = new Date(start.getTime() - 15 * 60000);
      events.push({
        user_id: userId,
        task_id: t.id,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        remind_at: remind > now ? remind.toISOString() : null,
      });
      cursor.setTime(end.getTime() + 10 * 60000); // 10 min buffer
    }

    if (events.length === 0) return { scheduled: 0 };

    const { error: insErr } = await supabase.from("task_events").insert(events);
    if (insErr) throw new Error(insErr.message);

    // Mark scheduled tasks as planned
    const ids = events.map((e) => e.task_id);
    await supabase
      .from("tasks")
      .update({ status: "planned" })
      .eq("user_id", userId)
      .in("id", ids)
      .eq("status", "inbox");

    return { scheduled: events.length };
  });

// ---------- Event CRUD ----------

export const moveEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      start_at: z.string().datetime(),
      end_at: z.string().datetime(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const remind = new Date(new Date(data.start_at).getTime() - 15 * 60000).toISOString();
    const { error } = await supabase
      .from("task_events")
      .update({ start_at: data.start_at, end_at: data.end_at, remind_at: remind, reminded_at: null })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("task_events")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
