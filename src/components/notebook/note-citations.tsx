import { useMemo, useState, type ReactNode } from "react";
import { Copy, Check, Quote } from "lucide-react";
import { toast } from "sonner";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { SourceViewer } from "@/components/notebook/source-viewer";
import { chunkText, sourceFullText } from "@/lib/chunker";
import { useCitationStyle } from "@/lib/citation-prefs";
import type { ChatSnippet } from "@/lib/notebook-chat.functions";
import type { ProjectSource } from "@/lib/project-sources.functions";

type NoteLike = {
  id: string;
  content_md: string;
  source_id: string | null;
  metadata: unknown;
};

function extractCitedIndices(text: string, max: number): number[] {
  const set = new Set<number>();
  const re = /\[(\d{1,3})\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= max) set.add(n - 1);
  }
  return Array.from(set).sort((a, b) => a - b);
}

export function NoteCitations({
  note,
  source,
  projectId,
  lang,
}: {
  note: NoteLike;
  source: ProjectSource | null;
  projectId: string;
  lang: string;
}) {
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [citationStyle] = useCitationStyle();

  // Recompute chunks deterministically from the source.
  const chunks = useMemo(() => {
    if (!source) return [];
    return chunkText(sourceFullText(source.title, source.url, source.content_md));
  }, [source]);

  const cited = useMemo(
    () => extractCitedIndices(note.content_md, chunks.length || 999),
    [note.content_md, chunks.length],
  );

  if (!source || chunks.length === 0 || cited.length === 0) {
    // No citations to render — just show plain text.
    return (
      <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground">
        {note.content_md}
      </pre>
    );
  }

  const chunkToSnippet = (i: number): ChatSnippet => ({
    chunk_index: i,
    content: chunks[i] ?? "",
    similarity: 1,
    answer_overlap: 1,
  });

  const onOpen = (n: number) => setViewerIdx(n - 1);

  const rendered: ReactNode[] = (() => {
    const out: ReactNode[] = [];
    const re = /\[(\d{1,3})\]/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let k = 0;
    while ((m = re.exec(note.content_md))) {
      if (m.index > last) out.push(note.content_md.slice(last, m.index));
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= chunks.length) {
        const snippet = chunks[n - 1];
        out.push(
          <HoverCard key={`nc-${k++}`} openDelay={120} closeDelay={60}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                onClick={() => onOpen(n)}
                className="mx-0.5 inline-flex items-center align-baseline rounded bg-primary/15 px-1 py-0 font-mono text-[10px] font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                title={lang === "th" ? "ดูข้อความอ้างอิง" : "View cited excerpt"}
              >
                [{n}]
              </button>
            </HoverCardTrigger>
            <HoverCardContent side="top" className="w-80 p-3 text-xs">
              <div className="mb-1.5 flex items-center gap-1.5 border-b pb-1.5">
                <span className="rounded bg-primary/15 px-1 py-0.5 font-mono text-[10px] text-primary">
                  [{n}]
                </span>
                <span className="line-clamp-1 flex-1 text-[11px] font-medium">
                  {source.title}
                </span>
              </div>
              <div className="line-clamp-5 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                <Quote className="mr-1 inline h-3 w-3 -translate-y-px text-primary/60" />
                {snippet.slice(0, 320)}
                {snippet.length > 320 ? "…" : ""}
              </div>
              <div className="mt-2 text-[10px] text-primary">
                {lang === "th" ? "คลิกเพื่อดูเนื้อหาเต็ม →" : "Click to view full content →"}
              </div>
            </HoverCardContent>
          </HoverCard>,
        );
      } else {
        out.push(m[0]);
      }
      last = m.index + m[0].length;
    }
    if (last < note.content_md.length) out.push(note.content_md.slice(last));
    return out;
  })();

  const copyWithCitations = async () => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const link =
      source.url ?? `${origin}/projects/${projectId}#source-${source.id}`;
    const lines = cited.map(
      (i) => `[${i + 1}] ${source.title} (chunk ${i + 1}) — ${link}`,
    );
    const text = `${note.content_md}\n\n${lang === "th" ? "แหล่งอ้างอิง" : "Sources"}:\n${lines.join("\n")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(lang === "th" ? "คัดลอกพร้อมอ้างอิงแล้ว" : "Copied with citations");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(lang === "th" ? "คัดลอกไม่สำเร็จ" : "Copy failed");
    }
  };

  const showPanel = citationStyle === "with_panel";

  return (
    <div className="space-y-2">
      <div className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
        {rendered}
      </div>

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <button
          type="button"
          onClick={copyWithCitations}
          className="inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 hover:border-primary hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-600" />
              {lang === "th" ? "คัดลอกแล้ว" : "Copied"}
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              {lang === "th" ? "คัดลอก + อ้างอิง" : "Copy + citations"}
            </>
          )}
        </button>
        <span>
          {lang === "th"
            ? `อ้างอิง ${cited.length} ส่วนจาก: ${source.title}`
            : `${cited.length} citation(s) from: ${source.title}`}
        </span>
      </div>

      {showPanel && (
        <div className="space-y-1 rounded-md border border-border/60 bg-muted/20 p-2">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {lang === "th" ? "แหล่งที่อ้างอิง" : "Cited sources"}
          </div>
          <ul className="space-y-1">
            {cited.map((i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setViewerIdx(i)}
                  className="group flex w-full items-start gap-2 rounded p-1.5 text-left hover:bg-background"
                >
                  <span className="mt-0.5 shrink-0 rounded bg-primary/15 px-1 py-0 font-mono text-[10px] font-semibold text-primary">
                    [{i + 1}]
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 text-[11px] font-medium">
                      {source.title}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[10px] text-muted-foreground group-hover:text-foreground">
                      “{chunks[i]?.slice(0, 180) ?? ""}
                      {(chunks[i]?.length ?? 0) > 180 ? "…" : ""}”
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <SourceViewer
        open={viewerIdx !== null}
        onOpenChange={(o) => !o && setViewerIdx(null)}
        source={source}
        snippets={viewerIdx !== null ? [chunkToSnippet(viewerIdx)] : []}
        lang={lang}
        index={viewerIdx !== null ? viewerIdx + 1 : 0}
      />
    </div>
  );
}
