// Server-only: resolve dept route/provider and run through chain
import { runWithRoute, type ProviderRow, type RouteChain, type AttemptLog } from "@/lib/providers.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export type RoutedResult = {
  text: string;
  usage: { promptTokens: number; completionTokens: number; costUsd: number };
  provider_kind: string;
  provider_id: string;
  attempts: AttemptLog[];
};

/**
 * Resolve a chain for a department, optionally pinned to a specific provider/route via `selector`.
 * Selector formats supported:
 *   - "provider:<uuid>"  → single-step chain using that provider only
 *   - "route:<uuid>"     → use that route's chain
 *   - <uuid>             → try as route id, then as provider id
 *   - null/empty         → use dept default route, else first enabled provider
 */
export async function runViaDeptRoute(
  supabase: SB,
  department: string,
  selector: string | null,
  systemPrompt: string,
  userPrompt: string,
): Promise<RoutedResult> {
  // Load providers (RLS allows dept members)
  const { data: provRows, error: pErr } = await supabase
    .from("dept_model_providers")
    .select("*")
    .eq("department", department)
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  if (pErr) throw new Error(pErr.message);
  const providers = (provRows ?? []) as ProviderRow[];
  if (providers.length === 0) {
    throw new Error("ยังไม่ได้ตั้งค่า provider ของหน่วยงาน");
  }

  // Determine chain
  let chain: RouteChain | null = null;

  const parsed = selector ? parseSelector(selector) : null;
  if (parsed?.kind === "provider") {
    chain = [{ provider_id: parsed.id, on_error: ["any"] }];
  } else if (parsed?.kind === "route") {
    chain = await loadRouteChain(supabase, department, parsed.id);
  } else if (parsed?.kind === "uuid") {
    // try route first, then provider
    chain = await loadRouteChain(supabase, department, parsed.id).catch(() => null);
    if (!chain) chain = [{ provider_id: parsed.id, on_error: ["any"] }];
  }

  if (!chain) {
    // default route
    const { data: routeRow } = await supabase
      .from("dept_model_routes")
      .select("chain")
      .eq("department", department)
      .eq("is_default", true)
      .maybeSingle();
    if (routeRow?.chain && Array.isArray(routeRow.chain) && routeRow.chain.length > 0) {
      chain = routeRow.chain as RouteChain;
    } else {
      // fallback: chain across all enabled providers, any-error fallback
      chain = providers.map((p) => ({ provider_id: p.id, on_error: ["any"] as Array<"any"> }));
    }
  }

  const { result, provider_used, attempts } = await runWithRoute(
    providers,
    chain,
    systemPrompt,
    userPrompt,
  );

  return {
    text: result.text,
    usage: {
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      costUsd: result.costUsd,
    },
    provider_kind: provider_used.kind,
    provider_id: provider_used.id,
    attempts,
  };
}

function parseSelector(
  s: string,
): { kind: "provider" | "route" | "uuid"; id: string } | null {
  if (!s) return null;
  if (s.startsWith("provider:")) return { kind: "provider", id: s.slice(9) };
  if (s.startsWith("route:")) return { kind: "route", id: s.slice(6) };
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    return { kind: "uuid", id: s };
  }
  return null;
}

async function loadRouteChain(supabase: SB, department: string, id: string): Promise<RouteChain | null> {
  const { data, error } = await supabase
    .from("dept_model_routes")
    .select("chain")
    .eq("id", id)
    .eq("department", department)
    .maybeSingle();
  if (error || !data) return null;
  return (data.chain as RouteChain) ?? null;
}
