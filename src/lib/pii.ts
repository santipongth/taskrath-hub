// PII redaction for Thai government context.
// Replaces PII with stable tokens before sending to AI; restore reverses it.

export type RedactResult = {
  text: string;
  map: Record<string, string>; // token -> original
  counts: Record<string, number>;
};

// Thai national ID (13 digits) with checksum validation
function isValidThaiId(id: string): boolean {
  const d = id.replace(/\D/g, "");
  if (d.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(d[i], 10) * (13 - i);
  const check = (11 - (sum % 11)) % 10;
  return check === parseInt(d[12], 10);
}

const PATTERNS: Array<{ kind: string; regex: RegExp; validate?: (s: string) => boolean }> = [
  // Thai ID — allow with or without dashes (1-2345-67890-12-3)
  { kind: "ID", regex: /\b\d{1}[- ]?\d{4}[- ]?\d{5}[- ]?\d{2}[- ]?\d{1}\b/g, validate: isValidThaiId },
  { kind: "EMAIL", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  // Thai phone: 0XX-XXX-XXXX or +66... (8-10 digits)
  { kind: "PHONE", regex: /(?:\+66|0)[\s-]?\d{1,2}[\s-]?\d{3}[\s-]?\d{4}\b/g },
  // Bank-like (10-14 consecutive digits)
  { kind: "ACCT", regex: /\b\d{10,14}\b/g },
];

export function redactPII(text: string): RedactResult {
  const map: Record<string, string> = {};
  const counts: Record<string, number> = {};
  const indexes: Record<string, number> = {};
  let result = text;

  for (const { kind, regex, validate } of PATTERNS) {
    result = result.replace(regex, (m) => {
      if (validate && !validate(m)) return m;
      // Skip if already inside an existing token
      if (/^\[(ID|EMAIL|PHONE|ACCT)_\d+\]$/.test(m)) return m;
      indexes[kind] = (indexes[kind] ?? 0) + 1;
      const token = `[${kind}_${indexes[kind]}]`;
      map[token] = m;
      counts[kind] = (counts[kind] ?? 0) + 1;
      return token;
    });
  }
  return { text: result, map, counts };
}

export function restorePII(text: string, map: Record<string, string>): string {
  let result = text;
  for (const [token, original] of Object.entries(map)) {
    result = result.split(token).join(original);
  }
  return result;
}

export function piiSummary(counts: Record<string, number>): string {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!total) return "";
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k}×${n}`);
  return parts.join(", ");
}
