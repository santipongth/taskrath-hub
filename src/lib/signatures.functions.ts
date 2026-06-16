import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase as publicClient } from "@/integrations/supabase/client";

export type VerifySignature = {
  id: string;
  signer_name: string;
  signer_position: string;
  agency_name: string;
  document_subject: string;
  ref_no: string;
  content_hash: string;
  signed_at: string;
};

export const createSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      runId: z.string().uuid().nullable().optional(),
      signerName: z.string().min(1).max(200),
      signerPosition: z.string().max(200).default(""),
      agencyName: z.string().max(300).default(""),
      documentSubject: z.string().max(500).default(""),
      refNo: z.string().max(120).default(""),
      contentHash: z.string().min(8).max(128).regex(/^[a-f0-9]+$/i),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("signed_documents")
      .insert({
        run_id: data.runId ?? null,
        user_id: userId,
        signer_name: data.signerName,
        signer_position: data.signerPosition,
        agency_name: data.agencyName,
        document_subject: data.documentSubject,
        ref_no: data.refNo,
        content_hash: data.contentHash.toLowerCase(),
      })
      .select("id, signed_at")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, signedAt: row.signed_at as string };
  });

// Public (no auth) — used by /verify/$id page; calls SECURITY DEFINER RPC
// that returns only the single requested row (no table-wide enumeration).
export async function fetchVerifySignature(id: string): Promise<VerifySignature | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const { data, error } = await publicClient.rpc("verify_signed_document", { p_id: id });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row as VerifySignature;
}

// Browser-side helper
export async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
