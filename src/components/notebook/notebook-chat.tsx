import { useState, useRef, useEffect, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import {
  Loader2,
  Send,
  MessageSquare,
  Trash2,
  Sparkles,
  BookOpen,
  ExternalLink,
  Info,
  Quote,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  askProjectChat,
  type ChatTurn,
  type ChatCitation,
} from "@/lib/notebook-chat.functions";
import { SourceViewer } from "@/components/notebook/source-viewer";
import type { ProjectSource } from "@/lib/project-sources.functions";

type Message = ChatTurn & { citations?: ChatCitation[]; id: string };

const SUGGESTIONS_TH = [
  "สรุปประเด็นสำคัญทั้งหมดให้เป็น bullet",
  "มีข้อสรุป/ข้อเสนอแนะอะไรบ้าง?",
  "อธิบายแบบเข้าใจง่ายสำหรับคนทั่วไป",
  "ความเสี่ยงหรือข้อควรระวังคืออะไร?",
];
const SUGGESTIONS_EN = [
  "Summarize the key points as bullets",
  "What are the conclusions or recommendations?",
  "Explain in simple terms for a layperson",
  "What are the risks or caveats?",
];

/**
 * Splits assistant text on [N] markers and renders each as an inline clickable
 * citation chip with a hover-preview of the cited snippet.
 */
function renderAssistantText(
  text: string,
  citations: ChatCitation[] | undefined,
  onOpen: (citation: ChatCitation, index: number) => void,
  lang: string,
): ReactNode[] {
  if (!citations || citations.length === 0) return [text];
  const re = /\[(\d{1,2})\]/g;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const n = parseInt(m[1], 10);
    const c = citations[n - 1];
    if (c) {
      const top = c.snippets[0];
      out.push(
        <HoverCard key={`cite-${key++}`} openDelay={120} closeDelay={60}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              onClick={() => onOpen(c, n)}
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
                {c.title}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {Math.round(c.similarity * 100)}%
              </span>
            </div>
            {top && (
              <div className="line-clamp-5 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                <Quote className="mr-1 inline h-3 w-3 -translate-y-px text-primary/60" />
                {top.content.slice(0, 320)}
                {top.content.length > 320 ? "…" : ""}
              </div>
            )}
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
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function NotebookChat({
  projectId,
  lang,
  sourceCount = 0,
  sources = [],
}: {
  projectId: string;
  lang: string;
  sourceCount?: number;
  sources?: ProjectSource[];
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [viewer, setViewer] = useState<{
    citation: ChatCitation;
    index: number;
  } | null>(null);

  const askFn = useServerFn(askProjectChat);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const askMut = useMutation({
    mutationFn: (turns: ChatTurn[]) =>
      askFn({ data: { project_id: projectId, messages: turns } }),
    onSuccess: (r) => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: r.answer,
          citations: r.citations,
        },
      ]);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const sendText = (raw: string) => {
    const q = raw.trim();
    if (q.length < 3 || askMut.isPending) return;
    const next: Message[] = [
      ...messages,
      { id: crypto.randomUUID(), role: "user", content: q },
    ];
    setMessages(next);
    setInput("");
    askMut.mutate(next.map(({ role, content }) => ({ role, content })));
  };

  const openCitation = (c: ChatCitation, index: number) =>
    setViewer({ citation: c, index });

  const hasSources = sourceCount > 0;
  const suggestions = lang === "th" ? SUGGESTIONS_TH : SUGGESTIONS_EN;
  const viewerSource =
    viewer && sources.find((s) => s.id === viewer.citation.source_id);

  return (
    <section className="flex h-full flex-col rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <MessageSquare className="h-4 w-4 text-primary" />
            {lang === "th" ? "แชทกับ Notebook" : "Chat with Notebook"}
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {lang === "th"
              ? "ถามคำถาม — AI ค้นจากแหล่งและตอบพร้อม [อ้างอิง] ที่คลิกดูได้"
              : "Ask anything — answers include clickable [citations] to the source"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground"
            title={lang === "th" ? "แหล่งข้อมูลที่พร้อมค้นหา" : "Sources available"}
          >
            <BookOpen className="h-3 w-3" />
            {sourceCount}
          </span>
          {messages.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setMessages([])}>
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              {lang === "th" ? "ล้าง" : "Clear"}
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollerRef}
        className="flex-1 min-h-[180px] max-h-[460px] space-y-3 overflow-y-auto px-4 py-3"
      >
        {messages.length === 0 ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-dashed bg-muted/20 p-4">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {lang === "th" ? "เริ่มต้นง่ายๆ" : "Quick start"}
              </div>
              {hasSources ? (
                <p className="text-[11px] text-muted-foreground">
                  {lang === "th"
                    ? `มีแหล่งข้อมูล ${sourceCount} รายการพร้อมใช้งาน เลือกคำถามด่วน หรือพิมพ์เอง — เลข [1][2] ในคำตอบคลิกได้`
                    : `${sourceCount} source(s) ready. Pick a quick question or type your own — [1][2] in answers are clickable.`}
                </p>
              ) : (
                <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <Info className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                  {lang === "th"
                    ? "ยังไม่มีแหล่งข้อมูล — เพิ่มลิงก์ / อัปโหลด PDF / วางข้อความ ในการ์ด ‘แหล่งข้อมูล’ ด้านล่างก่อน แล้วค่อยถามครับ"
                    : "No sources yet — add a URL / PDF / text in the ‘Sources’ card below, then come back to ask."}
                </p>
              )}
            </div>
            {hasSources && (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendText(s)}
                    className="rounded-full border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
              {m.role === "user" ? (
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                  {m.content}
                </div>
              ) : (
                <div className="max-w-full space-y-2">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {renderAssistantText(m.content, m.citations, openCitation, lang)}
                  </div>
                  {m.citations && m.citations.length > 0 && (
                    <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/20 p-2">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {lang === "th" ? "แหล่งที่อ้างอิง" : "Cited sources"}
                      </div>
                      <ul className="space-y-1">
                        {m.citations.map((c, i) => {
                          const top = c.snippets[0];
                          return (
                            <li key={`${m.id}-${c.source_id}`}>
                              <button
                                type="button"
                                onClick={() => openCitation(c, i + 1)}
                                className="group flex w-full items-start gap-2 rounded p-1.5 text-left hover:bg-background"
                              >
                                <span className="mt-0.5 shrink-0 rounded bg-primary/15 px-1 py-0 font-mono text-[10px] font-semibold text-primary">
                                  [{i + 1}]
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-1.5 text-[11px] font-medium">
                                    <span className="line-clamp-1">{c.title}</span>
                                    {c.url && (
                                      <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-50" />
                                    )}
                                    <span className="ml-auto shrink-0 font-mono text-[9px] text-muted-foreground">
                                      {Math.round(c.similarity * 100)}%
                                    </span>
                                  </span>
                                  {top && (
                                    <span className="mt-0.5 line-clamp-2 block text-[10px] text-muted-foreground group-hover:text-foreground">
                                      “{top.content.slice(0, 180)}
                                      {top.content.length > 180 ? "…" : ""}”
                                    </span>
                                  )}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        {askMut.isPending && (
          <div className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span>
              {lang === "th"
                ? "กำลังค้นหาในแหล่งข้อมูล แล้วเรียบเรียงคำตอบ…"
                : "Searching sources and composing answer…"}
            </span>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendText(input);
              }
            }}
            rows={1}
            placeholder={
              hasSources
                ? lang === "th"
                  ? "พิมพ์คำถาม… (Enter เพื่อส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
                  : "Ask anything… (Enter to send, Shift+Enter for newline)"
                : lang === "th"
                  ? "เพิ่มแหล่งข้อมูลก่อน แล้วค่อยถาม"
                  : "Add a source first, then ask"
            }
            disabled={askMut.isPending || !hasSources}
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            style={{ maxHeight: 120 }}
          />
          <Button
            onClick={() => sendText(input)}
            disabled={askMut.isPending || input.trim().length < 3 || !hasSources}
            size="icon"
            className="h-9 w-9 shrink-0"
            title={lang === "th" ? "ส่งคำถาม" : "Send"}
          >
            {askMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          {lang === "th"
            ? "เคล็ดลับ: คลิกเลข [1] [2] ในคำตอบเพื่อดูข้อความต้นทางที่ AI ใช้อ้างอิง"
            : "Tip: click [1] [2] in answers to see the exact text the AI cited."}
        </p>
      </div>

      <SourceViewer
        open={!!viewer}
        onOpenChange={(o) => !o && setViewer(null)}
        source={viewerSource ?? null}
        snippets={viewer?.citation.snippets ?? []}
        lang={lang}
        index={viewer?.index ?? 0}
        fallbackTitle={viewer?.citation.title}
        fallbackUrl={viewer?.citation.url}
      />
    </section>
  );
}
