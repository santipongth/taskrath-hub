import { useRef, useState, useEffect, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Heading1, Heading2, Heading3, List, ListChecks, Quote, Code2, Minus, Table, Bold } from "lucide-react";

type SlashCmd = {
  id: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  insert: string;
  cursorOffset?: number; // offset from end where cursor should land
};

const COMMANDS: SlashCmd[] = [
  { id: "h1", label: "Heading 1", desc: "# หัวข้อใหญ่", icon: Heading1, insert: "# " },
  { id: "h2", label: "Heading 2", desc: "## หัวข้อย่อย", icon: Heading2, insert: "## " },
  { id: "h3", label: "Heading 3", desc: "### หัวข้อเล็ก", icon: Heading3, insert: "### " },
  { id: "bullet", label: "Bullet list", desc: "- รายการ", icon: List, insert: "- " },
  { id: "todo", label: "Todo", desc: "- [ ] สิ่งที่ต้องทำ", icon: ListChecks, insert: "- [ ] " },
  { id: "quote", label: "Quote", desc: "> คำอ้างอิง", icon: Quote, insert: "> " },
  { id: "code", label: "Code block", desc: "``` โค้ด ```", icon: Code2, insert: "```\n\n```", cursorOffset: -4 },
  { id: "divider", label: "Divider", desc: "เส้นคั่น ---", icon: Minus, insert: "\n---\n" },
  { id: "table", label: "Table", desc: "ตาราง 2 คอลัมน์", icon: Table, insert: "| คอลัมน์ A | คอลัมน์ B |\n| --- | --- |\n|  |  |\n" },
  { id: "bold", label: "Bold", desc: "**ตัวหนา**", icon: Bold, insert: "****", cursorOffset: -2 },
];

export function MarkdownEditor({
  value,
  onChange,
  rows = 12,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [menu, setMenu] = useState<{ open: boolean; query: string; at: number; idx: number }>({
    open: false,
    query: "",
    at: 0,
    idx: 0,
  });

  const filtered = menu.open
    ? COMMANDS.filter((c) => {
        if (!menu.query) return true;
        const q = menu.query.toLowerCase();
        return c.id.includes(q) || c.label.toLowerCase().includes(q);
      })
    : [];

  useEffect(() => {
    if (menu.open && menu.idx >= filtered.length) {
      setMenu((m) => ({ ...m, idx: 0 }));
    }
  }, [menu.open, menu.idx, filtered.length]);

  const checkSlash = (text: string, caret: number) => {
    // find "/" at caret position scanning back, allow only word chars after it
    let i = caret - 1;
    while (i >= 0) {
      const ch = text[i];
      if (ch === "/") {
        // must be at start of line or preceded by whitespace
        const prev = i > 0 ? text[i - 1] : "\n";
        if (prev === "\n" || /\s/.test(prev) || i === 0) {
          const q = text.slice(i + 1, caret);
          if (/^[a-zA-Z0-9-]*$/.test(q)) {
            setMenu({ open: true, query: q, at: i, idx: 0 });
            return;
          }
        }
        break;
      }
      if (!/[a-zA-Z0-9-]/.test(ch)) break;
      i--;
    }
    setMenu((m) => (m.open ? { ...m, open: false } : m));
  };

  const insertCommand = (cmd: SlashCmd) => {
    const ta = ref.current;
    if (!ta) return;
    const before = value.slice(0, menu.at);
    const after = value.slice(ta.selectionEnd);
    const next = before + cmd.insert + after;
    onChange(next);
    const newCaret = before.length + cmd.insert.length + (cmd.cursorOffset ?? 0);
    setMenu((m) => ({ ...m, open: false }));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newCaret, newCaret);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!menu.open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMenu((m) => ({ ...m, idx: (m.idx + 1) % filtered.length }));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMenu((m) => ({ ...m, idx: (m.idx - 1 + filtered.length) % filtered.length }));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertCommand(filtered[menu.idx]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMenu((m) => ({ ...m, open: false }));
    }
  };

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        rows={rows}
        value={value}
        placeholder={placeholder ?? "พิมพ์ '/' เพื่อเปิดเมนูคำสั่ง…"}
        onChange={(e) => {
          onChange(e.target.value);
          checkSlash(e.target.value, e.target.selectionStart ?? 0);
        }}
        onClick={(e) => checkSlash(value, (e.target as HTMLTextAreaElement).selectionStart ?? 0)}
        onKeyUp={(e) => {
          if (["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key)) return;
          checkSlash(value, (e.target as HTMLTextAreaElement).selectionStart ?? 0);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setMenu((m) => ({ ...m, open: false })), 150)}
        className="font-mono text-sm"
      />
      {menu.open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-64 w-72 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Slash commands
          </div>
          {filtered.map((c, i) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertCommand(c);
                }}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs ${
                  i === menu.idx ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                }`}
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{c.label}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{c.desc}</div>
                </div>
                <code className="rounded bg-muted px-1 text-[10px] text-muted-foreground">/{c.id}</code>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
