import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SkillIcon, LUCIDE_OPTIONS, parseIcon } from "./SkillIcon";
import { useI18n } from "@/lib/i18n";
import { X } from "lucide-react";

type Props = {
  value: string | null;
  onChange: (v: string | null) => void;
};

export function IconPicker({ value, onChange }: Props) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const parsed = parseIcon(value);
  const [emoji, setEmoji] = useState<string>(parsed.kind === "emoji" ? (parsed.emoji ?? "") : "");

  const pickLucide = (id: string) => {
    onChange(`lucide:${id}`);
    setOpen(false);
  };
  const applyEmoji = () => {
    const trimmed = emoji.trim();
    if (!trimmed) {
      onChange(null);
    } else {
      onChange(`emoji:${trimmed.slice(0, 4)}`);
    }
    setOpen(false);
  };
  const clear = () => {
    onChange(null);
    setEmoji("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <SkillIcon value={value} className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs text-muted-foreground">
            {value
              ? (lang === "th" ? "เปลี่ยนไอคอน" : "Change icon")
              : (lang === "th" ? "เลือกไอคอน" : "Pick an icon")}
          </span>
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); clear(); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); clear(); } }}
              className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="clear icon"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3 space-y-3">
        <div>
          <Label className="text-[11px] uppercase text-muted-foreground">
            {lang === "th" ? "ไอคอน Lucide" : "Lucide icons"}
          </Label>
          <div className="mt-1.5 grid grid-cols-8 gap-1">
            {LUCIDE_OPTIONS.map(({ id, Icon }) => {
              const active = value === `lucide:${id}`;
              return (
                <button
                  key={id}
                  type="button"
                  title={id}
                  onClick={() => pickLucide(id)}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <Label className="text-[11px] uppercase text-muted-foreground">
            {lang === "th" ? "หรือ ใส่ Emoji" : "Or use emoji"}
          </Label>
          <div className="mt-1.5 flex gap-1.5">
            <Input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="✉️"
              maxLength={4}
              className="h-8"
            />
            <Button type="button" size="sm" onClick={applyEmoji} disabled={!emoji.trim()}>
              {lang === "th" ? "ใช้" : "Apply"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
