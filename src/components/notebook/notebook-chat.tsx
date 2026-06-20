import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import {
  Loader2, Send, MessageSquare, Trash2, Sparkles, BookOpen, ExternalLink, Info,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { askProjectChat, type ChatTurn, type ChatCitation } from "@/lib/notebook-chat.functions";

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

export function NotebookChat({
  projectId,
  lang,
  sourceCount = 0,
}: {
  projectId: string;
  lang: string;
  sourceCount?: number;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const askFn = useServerFn(askProjectChat);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const askMut = useMutation({
    mutationFn: (turns: ChatTurn[]) =>
      askFn({ data: { project_id: projectId, messages: turns } }),
    onSuccess: (r) => {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: r.answer, citations: r.citations },
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

  const hasSources = sourceCount > 0;
  const suggestions = lang === "th" ? SUGGESTIONS_TH : SUGGESTIONS_EN;

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
              ? "ถามคำถาม — AI จะค้นจากแหล่งของคุณและตอบพร้อม [อ้างอิง]"
              : "Ask questions — AI searches your sources and answers with [citations]"}
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
                    ? `มีแหล่งข้อมูล ${sourceCount} รายการพร้อมใช้งาน เลือกคำถามด่วน หรือพิมพ์เองด้านล่าง`
                    : `${sourceCount} source(s) ready. Pick a quick question or type your own below.`}
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
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
                  {m.citations && m.citations.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {lang === "th" ? "อ้างอิงจาก" : "Sources"}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {m.citations.map((c, i) => (
                          <a
                            key={`${m.id}-${c.source_id}`}
                            href={c.url ?? "#"}
                            target={c.url ? "_blank" : undefined}
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                            title={`${Math.round(c.similarity * 100)}% ${lang === "th" ? "ตรงกัน" : "match"}`}
                          >
                            <span className="font-mono">[{i + 1}]</span>
                            <span className="line-clamp-1 max-w-[200px]">{c.title}</span>
                            <span className="font-mono text-[9px] opacity-60">
                              {Math.round(c.similarity * 100)}%
                            </span>
                            {c.url && <ExternalLink className="h-2.5 w-2.5 opacity-60" />}
                          </a>
                        ))}
                      </div>
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
            {askMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          {lang === "th"
            ? "เคล็ดลับ: ระบุชื่อเอกสารหรือบริบทในคำถาม เช่น ‘สรุปสัญญาฉบับล่าสุด…’ จะตอบแม่นขึ้น"
            : "Tip: mention a document name or context (e.g. ‘summarize the latest contract…’) for sharper answers."}
        </p>
      </div>
    </section>
  );
}
