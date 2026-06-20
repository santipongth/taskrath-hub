import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProjectSource = {
  id: string;
  project_id: string;
  kind: "url" | "file" | "text" | "research";
  title: string;
  url: string | null;
  file_path: string | null;
  content_md: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ProjectNote = {
  id: string;
  project_id: string;
  source_id: string | null;
  title: string;
  content_md: string;
  origin: "manual" | "ai" | "transformation";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

const MAX_TITLE = 200;
const MAX_CONTENT = 200_000;

const sourceInput = z.object({
  id: z.string().uuid().optional(),
  project_id: z.string().uuid(),
  kind: z.enum(["url", "file", "text", "research"]),
  title: z.string().trim().min(1).max(MAX_TITLE),
  url: z.string().url().max(2000).optional().nullable(),
  file_path: z.string().max(500).optional().nullable(),
  content_md: z.string().max(MAX_CONTENT).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const listProjectSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("project_sources")
      .select("id, project_id, kind, title, url, file_path, content_md, metadata, created_at, updated_at")
      .eq("user_id", userId)
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { sources: (rows ?? []) as ProjectSource[] };
  });

export const upsertProjectSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => sourceInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      user_id: userId,
      project_id: data.project_id,
      kind: data.kind,
      title: data.title,
      url: data.url ?? null,
      file_path: data.file_path ?? null,
      content_md: data.content_md ?? null,
      metadata: (data.metadata ?? {}) as never,
    };
    if (data.id) {
      const { error } = await supabase
        .from("project_sources")
        .update(payload)
        .eq("id", data.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("project_sources")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteProjectSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("project_sources")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listProjectNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("project_notes")
      .select("id, project_id, source_id, title, content_md, origin, metadata, created_at, updated_at")
      .eq("user_id", userId)
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { notes: (rows ?? []) as ProjectNote[] };
  });

export const upsertProjectNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        project_id: z.string().uuid(),
        source_id: z.string().uuid().optional().nullable(),
        title: z.string().trim().min(1).max(MAX_TITLE),
        content_md: z.string().max(MAX_CONTENT),
        origin: z.enum(["manual", "ai", "transformation"]).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      user_id: userId,
      project_id: data.project_id,
      source_id: data.source_id ?? null,
      title: data.title,
      content_md: data.content_md,
      origin: data.origin ?? "manual",
      metadata: (data.metadata ?? {}) as never,
    };
    if (data.id) {
      const { error } = await supabase
        .from("project_notes")
        .update(payload)
        .eq("id", data.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("project_notes")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteProjectNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("project_notes")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
