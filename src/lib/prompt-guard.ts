// Lightweight prompt-injection heuristic. Returns a 0..100 risk score.

const PATTERNS: Array<{ regex: RegExp; weight: number; label: string }> = [
  { regex: /ignore (all |the )?(previous|above|prior) (instructions|prompts?|messages?)/i, weight: 60, label: "ignore-previous" },
  { regex: /disregard (all |the )?(previous|above|prior)/i, weight: 60, label: "disregard-previous" },
  { regex: /(reveal|show|print|leak)\s+(the\s+)?(system\s+)?prompt/i, weight: 70, label: "leak-prompt" },
  { regex: /you are now (?!a (helpful|formal))/i, weight: 40, label: "role-switch" },
  { regex: /\bDAN\b|jailbreak|developer mode/i, weight: 50, label: "jailbreak" },
  { regex: /ละเว้นคำสั่ง|ลืมคำสั่ง|ไม่ต้องสนใจคำสั่ง/i, weight: 60, label: "th-ignore" },
  { regex: /แสดง(prompt|พรอมต์|คำสั่งระบบ)/i, weight: 70, label: "th-leak-prompt" },
  { regex: /<\|.*?\|>/g, weight: 30, label: "control-tokens" },
  { regex: /\bsystem\s*:\s*/i, weight: 20, label: "fake-role" },
];

export type GuardResult = {
  score: number; // 0..100
  hits: string[];
  decision: "allow" | "warn" | "block";
};

export function checkPromptInjection(text: string): GuardResult {
  let score = 0;
  const hits: string[] = [];
  for (const { regex, weight, label } of PATTERNS) {
    if (regex.test(text)) {
      score += weight;
      hits.push(label);
    }
  }
  score = Math.min(100, score);
  const decision: GuardResult["decision"] = score >= 70 ? "block" : score >= 40 ? "warn" : "allow";
  return { score, hits, decision };
}
