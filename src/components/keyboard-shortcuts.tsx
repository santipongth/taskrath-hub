import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { Keyboard } from "lucide-react";

type Shortcut = { keys: string[]; th: string; en: string };

const SHORTCUTS: { sectionTh: string; sectionEn: string; items: Shortcut[] }[] = [
  {
    sectionTh: "ทั่วไป",
    sectionEn: "General",
    items: [
      { keys: ["⌘", "K"], th: "เปิดค้นหา/สั่งงานด่วน", en: "Open command palette" },
      { keys: ["?"], th: "เปิด/ปิดคู่มือคีย์ลัด", en: "Toggle this cheat sheet" },
      { keys: ["⌘", "B"], th: "ย่อ/ขยาย sidebar", en: "Toggle sidebar" },
      { keys: ["Esc"], th: "ปิดหน้าต่าง dialog", en: "Close dialog" },
    ],
  },
  {
    sectionTh: "ไปยังหน้า (กด g ตามด้วยปุ่ม)",
    sectionEn: "Navigation (press g then key)",
    items: [
      { keys: ["g", "h"], th: "หน้าหลัก", en: "Dashboard" },
      { keys: ["g", "r"], th: "สั่งงาน AI", en: "Run AI" },
      { keys: ["g", "t"], th: "คลังเทมเพลต", en: "Templates" },
      { keys: ["g", "c"], th: "ถาม-ตอบ KB", en: "KB Chat" },
      { keys: ["g", "i"], th: "ประวัติการใช้งาน", en: "History" },
      { keys: ["g", "a"], th: "Agent & Skills", en: "Agents" },
      { keys: ["g", "s"], th: "ตั้งค่า", en: "Settings" },
      { keys: ["g", "u"], th: "การใช้งาน (admin)", en: "Admin · Usage" },
    ],
  },
  {
    sectionTh: "หน้าสั่งงาน",
    sectionEn: "Run page",
    items: [
      { keys: ["⌘", "↵"], th: "เริ่มงาน AI", en: "Run AI task" },
    ],
  },
];

const NAV_MAP: Record<string, string> = {
  h: "/",
  r: "/run",
  t: "/templates",
  c: "/chat",
  i: "/history",
  a: "/agents",
  s: "/settings",
  u: "/admin/usage",
};

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { t, lang } = useI18n();

  useEffect(() => {
    let gPending: number | null = null;

    const isTyping = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }

      if (e.key === "g") {
        if (gPending) window.clearTimeout(gPending);
        gPending = window.setTimeout(() => { gPending = null; }, 800);
        return;
      }

      if (gPending) {
        const dest = NAV_MAP[e.key.toLowerCase()];
        window.clearTimeout(gPending);
        gPending = null;
        if (dest) {
          e.preventDefault();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          navigate({ to: dest as any });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    const onOpen = () => setOpen(true);
    window.addEventListener("open-shortcuts", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-shortcuts", onOpen);
      if (gPending) window.clearTimeout(gPending);
    };
  }, [navigate]);

  const L = (th: string, en: string) => (lang === "th" ? th : en);
  void t;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" />
            {L("คีย์ลัด (Keyboard shortcuts)", "Keyboard shortcuts")}
          </DialogTitle>
          <DialogDescription>
            {L("กด ? ได้ทุกเมื่อเพื่อเปิดคู่มือนี้", "Press ? anytime to open this sheet")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          {SHORTCUTS.map((sec) => (
            <section key={sec.sectionEn}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {L(sec.sectionTh, sec.sectionEn)}
              </h3>
              <ul className="divide-y divide-border rounded-md border border-border">
                {sec.items.map((sc) => (
                  <li key={sc.keys.join("+") + sc.en} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="text-foreground">{L(sc.th, sc.en)}</span>
                    <span className="flex items-center gap-1">
                      {sc.keys.map((k, i) => (
                        <kbd key={i} className="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground">
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
