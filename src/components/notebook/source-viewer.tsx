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
import { CHUNK_CHARS, CHUNK_OVERLAP } from "@/lib/chunker";

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

/**
 * Try to find the chunk inside the content text using progressively shorter
 * windows. Returns the [startIndex, endIndex] in the ORIGINAL (un-escaped) text,
 * or null if not found via substring.
 */
function locateChunk(content: string, chunkText: string): [number, number] | null {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  const haystack = content;

  // 1) full chunk content
  const full = chunkText.trim();
  if (full.length > 0) {
    const idx = haystack.indexOf(full);
    if (idx >= 0) return [idx, idx + full.length];
  }
  // 2) first 200 chars
  const head = full.slice(0, 200).trim();
  if (head.length >= 30) {
    const idx = haystack.indexOf(head);
    if (idx >= 0) return [idx, idx + head.length];
  }
  // 3) last 200 chars
  const tail = full.slice(-200).trim();
  if (tail.length >= 30) {
    const idx = haystack.indexOf(tail);
    if (idx >= 0) return [idx, idx + tail.length];
  }
  // 4) normalized first 120
  const n = norm(full).slice(0, 120);
  if (n.length >= 30) {
    const re = new RegExp(escapeRegex(n).replace(/\\ /g, "\\s+"), "i");
    const m = re.exec(haystack);
    if (m) return [m.index, m.index + m[0].length];
  }
  return null;
}

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

  // Build highlighted HTML with both substring and chunk-index based ranges,
  // then escape per segment so spans never break.
  const highlightedHtml = useMemo(() => {
    if (!source?.content_md) return null;
    const text = source.content_md;

    // Prefix from sourceFullText() before content_md begins (title \n\n url \n\n)
    const prefixLen =
      (source.title ? source.title.length : 0) +
      (source.title ? 2 : 0) +
      (source.url ? source.url.length + 2 : 0);

    type Range = { start: number; end: number; idx: number };
    const ranges: Range[] = [];

    snippets.forEach((s, i) => {
      const loc = locateChunk(text, s.content);
      if (loc) {
        ranges.push({ start: loc[0], end: loc[1], idx: i });
        return;
      }
      // Position-based fallback using chunk_index
      const fullStart = s.chunk_index * (CHUNK_CHARS - CHUNK_OVERLAP);
      const fullEnd = fullStart + CHUNK_CHARS;
      const start = Math.max(0, fullStart - prefixLen);
      const end = Math.max(start + 200, Math.min(text.length, fullEnd - prefixLen));
      if (start < text.length && end > start) {
        ranges.push({ start, end: Math.min(end, text.length), idx: i });
      }
    });

    if (ranges.length === 0) return escapeHtml(text);

    // Merge overlapping ranges (keep lowest idx)
    ranges.sort((a, b) => a.start - b.start);
    const merged: Range[] = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && r.start <= last.end) {
        last.end = Math.max(last.end, r.end);
      } else {
        merged.push({ ...r });
      }
    }

    let html = "";
    let cursor = 0;
    for (const r of merged) {
      if (r.start > cursor) html += escapeHtml(text.slice(cursor, r.start));
      const seg = text.slice(r.start, r.end);
      html += `<mark id="snip-${r.idx}" class="rounded bg-amber-200/70 px-0.5 text-foreground dark:bg-amber-400/30">${escapeHtml(seg)}</mark>`;
      cursor = r.end;
    }
    if (cursor < text.length) html += escapeHtml(text.slice(cursor));
    return html;
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
              {lang === "th"
                ? "ข้อความที่อ้างอิง (เรียงตามที่ตรงคำตอบมากที่สุด)"
                : "Referenced excerpts (ranked by answer relevance)"}
            </div>
            {snippets.map((s, i) => (
              <div
                key={`${s.chunk_index}-${i}`}
                ref={i === 0 ? firstSnipRef : undefined}
                className="rounded-md border-l-4 border-primary bg-primary/5 p-3 text-xs leading-relaxed"
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="font-mono">chunk #{s.chunk_index + 1}</span>
                  <span>•</span>
                  <span className="font-mono">
                    {Math.round(s.similarity * 100)}%{" "}
                    {lang === "th" ? "คล้ายคำถาม" : "vs. question"}
                  </span>
                  {typeof s.answer_overlap === "number" && (
                    <>
                      <span>•</span>
                      <span className="font-mono">
                        {Math.round(s.answer_overlap * 100)}%{" "}
                        {lang === "th" ? "ตรงกับคำตอบ" : "in answer"}
                      </span>
                    </>
                  )}
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
                dangerouslySetInnerHTML={{ __html: highlightedHtml ?? "" }}
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
