// Server-only: model provider invocation
// Loaded only from server-fn handlers / server routes.

export type ProviderRow = {
  id: string;
  department: string;
  name: string;
  kind: "lovable" | "openai_compatible" | "typhoon" | "hiclaw";
  base_url: string | null;
  model_id: string;
  api_key_secret_name: string | null;
  price_in_per_mtok: number;
  price_out_per_mtok: number;
  enabled: boolean;
};

export type ProviderCallResult = {
  text: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
};

function priceCost(p: ProviderRow, pt: number, ct: number) {
  return (
    (pt / 1_000_000) * Number(p.price_in_per_mtok ?? 0) +
    (ct / 1_000_000) * Number(p.price_out_per_mtok ?? 0)
  );
}

function resolveEndpoint(p: ProviderRow): { url: string; auth: string; model: string } {
  switch (p.kind) {
    case "lovable": {
      const key = process.env.LOVABLE_API_KEY;
      if (!key) throw new Error("LOVABLE_API_KEY missing");
      return {
        url: "https://ai.gateway.lovable.dev/v1/chat/completions",
        auth: `Bearer ${key}`,
        model: p.model_id || "google/gemini-2.5-flash",
      };
    }
    case "typhoon": {
      const key = p.api_key_secret_name
        ? process.env[p.api_key_secret_name]
        : process.env.TYPHOON_API_KEY;
      if (!key) throw new Error(`secret ${p.api_key_secret_name ?? "TYPHOON_API_KEY"} missing`);
      const base = (p.base_url || "https://api.opentyphoon.ai/v1").replace(/\/$/, "");
      return {
        url: `${base}/chat/completions`,
        auth: `Bearer ${key}`,
        model: p.model_id,
      };
    }
    case "hiclaw": {
      const base = (p.base_url || process.env.HICLAW_API_URL || "").replace(/\/$/, "");
      const key = p.api_key_secret_name
        ? process.env[p.api_key_secret_name]
        : process.env.HICLAW_API_KEY;
      if (!base) throw new Error("HiClaw base_url missing");
      if (!key) throw new Error("HiClaw API key missing");
      return {
        url: `${base}/v1/chat/completions`,
        auth: `Bearer ${key}`,
        model: p.model_id || process.env.HICLAW_MODEL || "default",
      };
    }
    case "openai_compatible": {
      if (!p.base_url) throw new Error("base_url required for openai_compatible");
      const key = p.api_key_secret_name ? process.env[p.api_key_secret_name] : undefined;
      if (!key) throw new Error(`secret ${p.api_key_secret_name ?? "(none)"} missing`);
      const base = p.base_url.replace(/\/$/, "");
      return {
        url: `${base}/chat/completions`,
        auth: `Bearer ${key}`,
        model: p.model_id,
      };
    }
  }
}

export async function callProvider(
  p: ProviderRow,
  systemPrompt: string,
  userPrompt: string,
): Promise<ProviderCallResult> {
  const { url, auth, model } = resolveEndpoint(p);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const tag = res.status === 429 ? "rate_limit" : res.status === 402 ? "credits" : `http_${res.status}`;
    const err = new Error(`${p.name} (${p.kind}) ${tag}: ${body.slice(0, 200)}`);
    (err as Error & { status?: number; tag?: string }).status = res.status;
    (err as Error & { status?: number; tag?: string }).tag = tag;
    throw err;
  }
  const json = await res.json();
  const pt = json.usage?.prompt_tokens ?? 0;
  const ct = json.usage?.completion_tokens ?? 0;
  return {
    text: json.choices?.[0]?.message?.content ?? "",
    promptTokens: pt,
    completionTokens: ct,
    costUsd: priceCost(p, pt, ct),
  };
}

export type AttemptLog = {
  provider_id: string;
  provider_kind: string;
  name: string;
  status: "ok" | "error";
  latency_ms: number;
  error?: string;
  tag?: string;
};

export type RouteChain = Array<{
  provider_id: string;
  on_error?: Array<"429" | "5xx" | "4xx" | "timeout" | "any">;
}>;

function shouldFallback(tag: string | undefined, onError: Array<string> | undefined): boolean {
  if (!onError || onError.length === 0 || onError.includes("any")) return true;
  if (!tag) return false;
  if (tag === "rate_limit" && onError.includes("429")) return true;
  if (tag.startsWith("http_5") && onError.includes("5xx")) return true;
  if (tag.startsWith("http_4") && onError.includes("4xx")) return true;
  if (tag === "timeout" && onError.includes("timeout")) return true;
  return false;
}

export async function runWithRoute(
  providers: ProviderRow[],
  chain: RouteChain,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ result: ProviderCallResult; provider_used: ProviderRow; attempts: AttemptLog[] }> {
  const byId = new Map(providers.map((p) => [p.id, p]));
  const attempts: AttemptLog[] = [];
  let lastErr: unknown = null;
  for (const step of chain) {
    const p = byId.get(step.provider_id);
    if (!p || !p.enabled) {
      attempts.push({
        provider_id: step.provider_id,
        provider_kind: p?.kind ?? "unknown",
        name: p?.name ?? "(missing)",
        status: "error",
        latency_ms: 0,
        error: p ? "disabled" : "not_found",
      });
      continue;
    }
    const t0 = Date.now();
    try {
      const result = await callProvider(p, systemPrompt, userPrompt);
      attempts.push({
        provider_id: p.id,
        provider_kind: p.kind,
        name: p.name,
        status: "ok",
        latency_ms: Date.now() - t0,
      });
      return { result, provider_used: p, attempts };
    } catch (e) {
      const tag = (e as Error & { tag?: string }).tag;
      attempts.push({
        provider_id: p.id,
        provider_kind: p.kind,
        name: p.name,
        status: "error",
        latency_ms: Date.now() - t0,
        error: e instanceof Error ? e.message.slice(0, 300) : String(e),
        tag,
      });
      lastErr = e;
      if (!shouldFallback(tag, step.on_error)) throw e;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("ไม่มี provider ใดในชุด route ที่เรียกสำเร็จ");
}
