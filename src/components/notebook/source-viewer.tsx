import { useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExternalLink, FileText, Link as LinkIcon, Telescope, FileUp } from "lucide-react";
import type { ChatSnippet } from "@/lib/notebook-chat.functions";

type Source = {
  id: string;
  title: string;
  url: string | null;
  kind: string;
  content_md: string | null;
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function SourceViewer({
  open,
  onOpenChange,
  source,
  snippets,
  lang,
  index,
  fallbackTitle,
  fallbackUrl,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  source: Source | null;
  snippets: ChatSnippet[];
  lang: string;
  index: number;
  fallbackTitle?: string;
  fallbackUrl?: string | null;
}) {
  const firstSnipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(
        () => firstSnipRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }),
        80,
      );
      return () => clearTimeout(t);
    }
  }, [open]);

  const highlighted = useMemo(() => {
    if (!source?.content_md) return null;
    let safe = escapeHtml(source.content_md);
    snippets.forEach((s, i) => {
      // Use first ~140 chars of the chunk as a robust anchor
      const needleRaw = s.content.trim().slice(0, 140).trim();
      if (needleRaw.length < 16) return;
      const needle = escapeHtml(needleRaw);
      const re = new RegExp(escapeRegex(needle), "i");
      safe = safe.replace(
        re,
        `<mark id="snip-${i}" class="rounded bg-amber-200/70 px-0.5 text-foreground dark:bg-amber-400/30">$&</mark>`,
      );
    });
    return safe;
  }, [source, snippets]);

  const Icon =
    source?.kind === "url"
      ? LinkIcon
      : source?.kind === "research"
        ? Telescope
        : source?.kind === "file"
          ? FileUp
          : FileText;

  const title = source?.title ?? fallbackTitle ?? "—";
  const url = source?.url ?? fallbackUrl ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left">
            <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-xs text-primary">
              [{index}]
            </span>
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="line-clamp-1">{title}</span>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-primary"
                title={lang === "th" ? "เปิดต้นทาง" : "Open source"}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </DialogTitle>
          <DialogDescription>
            {lang === "th"
              ? `อ้างอิง ${snippets.length} ส่วนจากแหล่งนี้ — ข้อความที่ AI ใช้ตอบจะถูกไฮไลต์สีเหลือง`
              : `${snippets.length} cited excerpt(s) — text used by the AI is highlighted in yellow`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {lang === "th" ? "ข้อความที่อ้างอิง" : "Referenced excerpts"}
            </div>
            {snippets.map((s, i) => (
              <div
                key={`${s.chunk_index}-${i}`}
                ref={i === 0 ? firstSnipRef : undefined}
                className="rounded-md border-l-4 border-primary bg-primary/5 p-3 text-xs leading-relaxed"
              >
                <div className="mb-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="font-mono">
                    chunk #{s.chunk_index + 1}
                  </span>
                  <span>•</span>
                  <span className="font-mono">
                    {Math.round(s.similarity * 100)}% {lang === "th" ? "ตรงกัน" : "match"}
                  </span>
                </div>
                <div className="whitespace-pre-wrap">{s.content}</div>
              </div>
            ))}
          </div>

          {source?.content_md ? (
            <div className="space-y-2">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {lang === "th" ? "เนื้อหาเต็มของแหล่ง" : "Full source content"}
              </div>
              <div
                className="max-w-none whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs leading-relaxed"
                dangerouslySetInnerHTML={{ __html: highlighted ?? "" }}
              />
            </div>
          ) : (
            <div className="rounded border border-dashed p-3 text-xs text-muted-foreground">
              {lang === "th"
                ? "ไม่มีเนื้อหาข้อความที่บันทึกไว้สำหรับแหล่งนี้ — กดลิงก์ด้านบนเพื่อดูต้นฉบับ"
                : "No stored text content for this source — open the original link above."}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
