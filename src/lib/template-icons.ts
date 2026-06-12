import {
  FileAudio, Mail, Inbox, StickyNote, Calculator, FileText,
  FileSignature, Stamp, Megaphone, MessagesSquare, Languages,
  SpellCheck, Scale, CalendarClock, ShieldCheck, Tags, BookText,
  ClipboardList, Briefcase, Building2, Users, type LucideIcon,
} from "lucide-react";

export const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  FileText, FileAudio, Mail, Inbox, StickyNote, Calculator,
  FileSignature, Stamp, Megaphone, MessagesSquare, Languages,
  SpellCheck, Scale, CalendarClock, ShieldCheck, Tags, BookText,
  ClipboardList, Briefcase, Building2, Users,
};

export const ICON_OPTIONS = Object.keys(TEMPLATE_ICONS);

export function getTemplateIcon(name: string | null | undefined): LucideIcon {
  return (name && TEMPLATE_ICONS[name]) || FileText;
}
