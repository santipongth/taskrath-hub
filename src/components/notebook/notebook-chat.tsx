import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Send, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askProjectChat, type ChatTurn, type ChatCitation } from "@/lib/notebook-chat.functions";

type Message = ChatTurn & { citations?: ChatCitation[]; id: string };

export function NotebookChat({ projectId, lang }: { projectId: string; lang: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const askFn = useServerFn(askProjectChat);
  const scrollerRef = useRef<HTMLDivElement>(null);

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

  const send = () => {
    const q = input.trim();
    if (q.length < 3 || askMut.isPending) return;
    const next: Message[] = [
      ...messages,
      { id: crypto.randomUUID(), role: "user", content: q },
    ];
    setMessages(next);
    setInput("");
    askMut.mutate(next.map(({ role, content }) => ({ role, content })));
  };

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <MessageSquare className="h-4 w-4 text-primary" />
          {lang === "th" ? "แชทกับ Notebook (Retrieval)" : "Chat with Notebook"}
        </h2>
        {messages.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setMessages([])}>
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            {lang === "th" ? "ล้าง" : "Clear"}
          </Button>
        )}
      </div>

      <div ref={scrollerRef} className="max-h-[420px] min-h-[140px] space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="rounded border border-dashed p-6 text-center text-xs text-muted-foreground">
            {lang === "th"
              ? "เริ่มถามอะไรก็ได้เกี่ยวกับเนื้อหาใน Notebook นี้ ระบบจะค้นแหล่งและตอบพร้อมอ้างอิง"
              : "Ask anything about your sources — answers come with citations."}
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
              {m.role === "user" ? (
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                  {m.content}
                </div>
              ) : (
                <div className="max-w-full space-y-2">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
                  {m.citations && m.citations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.citations.map((c, i) => (
                        <a
                          key={`${m.id}-${c.source_id}`}
                          href={c.url ?? "#"}
                          target={c.url ? "_blank" : undefined}
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
                          title={`${Math.round(c.similarity * 100)}% match`}
                        >
                          <span className="font-mono">[{i + 1}]</span>
                          <span className="line-clamp-1 max-w-[180px]">{c.title}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        {askMut.isPending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {lang === "th" ? "กำลังค้นหาและตอบ…" : "Thinking…"}
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={lang === "th" ? "พิมพ์คำถาม…" : "Type a question…"}
          disabled={askMut.isPending}
        />
        <Button onClick={send} disabled={askMut.isPending || input.trim().length < 3}>
          {askMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </section>
  );
}
