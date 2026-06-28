import {
  Sparkles, FileText, Mail, Search, FileSpreadsheet, Languages, Megaphone,
  Calendar, Stamp, BookOpen, Briefcase, Building2, ClipboardList, Code2,
  FileCheck2, FileSignature, Gavel, GraduationCap, Lightbulb, ListChecks,
  MessageSquare, NotebookPen, PenTool, Presentation, Receipt, ScrollText,
  ShieldCheck, Sigma, Telescope, Wand2, Users, type LucideIcon,
} from "lucide-react";

export const LUCIDE_OPTIONS: { id: string; Icon: LucideIcon }[] = [
  { id: "Sparkles", Icon: Sparkles },
  { id: "FileText", Icon: FileText },
  { id: "Mail", Icon: Mail },
  { id: "Search", Icon: Search },
  { id: "FileSpreadsheet", Icon: FileSpreadsheet },
  { id: "Languages", Icon: Languages },
  { id: "Megaphone", Icon: Megaphone },
  { id: "Calendar", Icon: Calendar },
  { id: "Stamp", Icon: Stamp },
  { id: "BookOpen", Icon: BookOpen },
  { id: "Briefcase", Icon: Briefcase },
  { id: "Building2", Icon: Building2 },
  { id: "ClipboardList", Icon: ClipboardList },
  { id: "Code2", Icon: Code2 },
  { id: "FileCheck2", Icon: FileCheck2 },
  { id: "FileSignature", Icon: FileSignature },
  { id: "Gavel", Icon: Gavel },
  { id: "GraduationCap", Icon: GraduationCap },
  { id: "Lightbulb", Icon: Lightbulb },
  { id: "ListChecks", Icon: ListChecks },
  { id: "MessageSquare", Icon: MessageSquare },
  { id: "NotebookPen", Icon: NotebookPen },
  { id: "PenTool", Icon: PenTool },
  { id: "Presentation", Icon: Presentation },
  { id: "Receipt", Icon: Receipt },
  { id: "ScrollText", Icon: ScrollText },
  { id: "ShieldCheck", Icon: ShieldCheck },
  { id: "Sigma", Icon: Sigma },
  { id: "Telescope", Icon: Telescope },
  { id: "Wand2", Icon: Wand2 },
  { id: "Users", Icon: Users },
];

const LUCIDE_MAP: Record<string, LucideIcon> = Object.fromEntries(
  LUCIDE_OPTIONS.map((o) => [o.id, o.Icon]),
);

export function parseIcon(value: string | null | undefined): { kind: "lucide" | "emoji" | "default"; lucide?: LucideIcon; emoji?: string } {
  if (!value) return { kind: "default" };
  if (value.startsWith("lucide:")) {
    const name = value.slice("lucide:".length);
    const Icon = LUCIDE_MAP[name];
    if (Icon) return { kind: "lucide", lucide: Icon };
    return { kind: "default" };
  }
  if (value.startsWith("emoji:")) {
    return { kind: "emoji", emoji: value.slice("emoji:".length) };
  }
  // Backward compat: legacy raw emoji string
  if (value.length <= 4) return { kind: "emoji", emoji: value };
  return { kind: "default" };
}

export function SkillIcon({
  value,
  className = "h-4 w-4",
}: {
  value: string | null | undefined;
  className?: string;
}) {
  const parsed = parseIcon(value);
  if (parsed.kind === "lucide" && parsed.lucide) {
    const Icon = parsed.lucide;
    return <Icon className={className} />;
  }
  if (parsed.kind === "emoji" && parsed.emoji) {
    return <span className={className} style={{ fontSize: "1em", lineHeight: 1 }}>{parsed.emoji}</span>;
  }
  return <Sparkles className={className} />;
}
