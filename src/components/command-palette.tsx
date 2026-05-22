import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { TEMPLATES } from "@/lib/templates";
import { useI18n } from "@/lib/i18n";
import {
  LayoutDashboard, Sparkles, LibraryBig, History as HistoryIcon,
  CheckCircle2, Settings, PieChart, Bell,
} from "lucide-react";

const PAGES = [
  { to: "/", labelTh: "หน้าหลัก", labelEn: "Dashboard", icon: LayoutDashboard },
  { to: "/run", labelTh: "สั่งงานอิสระ", labelEn: "Freeform Run", icon: Sparkles },
  { to: "/templates", labelTh: "เทมเพลตทั้งหมด", labelEn: "All Templates", icon: LibraryBig },
  { to: "/history", labelTh: "ประวัติการใช้งาน", labelEn: "History", icon: HistoryIcon },
  { to: "/approvals", labelTh: "การอนุมัติ", labelEn: "Approvals", icon: CheckCircle2 },
  { to: "/settings", labelTh: "ตั้งค่า", labelEn: "Settings", icon: Settings },
  { to: "/admin/dashboard", labelTh: "แดชบอร์ดผู้บริหาร", labelEn: "Executive Dashboard", icon: PieChart },
  { to: "/admin/notifications", labelTh: "การแจ้งเตือน", labelEn: "Notifications", icon: Bell },
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { lang } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    navigate({ to: to as any });
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={lang === "th" ? "ค้นหาเทมเพลต หรือหน้า…" : "Search templates or pages…"} />
      <CommandList>
        <CommandEmpty>{lang === "th" ? "ไม่พบผลลัพธ์" : "No results"}</CommandEmpty>
        <CommandGroup heading={lang === "th" ? "เทมเพลต" : "Templates"}>
          {TEMPLATES.map((tpl) => {
            const Icon = tpl.icon;
            return (
              <CommandItem
                key={tpl.id}
                value={`${tpl.titleTh} ${tpl.titleEn} ${tpl.descTh}`}
                onSelect={() => go(`/run/${tpl.id}`)}
              >
                <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{lang === "th" ? tpl.titleTh : tpl.titleEn}</span>
                <span className="ml-2 truncate text-xs text-muted-foreground">
                  {lang === "th" ? tpl.descTh : tpl.descEn}
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={lang === "th" ? "ไปที่หน้า" : "Navigate"}>
          {PAGES.map((p) => (
            <CommandItem
              key={p.to}
              value={`${p.labelTh} ${p.labelEn} ${p.to}`}
              onSelect={() => go(p.to)}
            >
              <p.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              {lang === "th" ? p.labelTh : p.labelEn}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
