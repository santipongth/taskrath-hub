import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listChatThreads,
  getChatThread,
  createChatThread,
  deleteChatThread,
  renameChatThread,
  sendChatMessage,
  type ChatMessage,
  type ChatThread,
} from "@/lib/chat.functions";
import { CitationsList } from "@/components/citations-list";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Send, Pencil, MessageSquare, BookText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { VoiceInputButton } from "@/components/voice-input-button";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({ meta: [{ title: "ถาม-ตอบ KB · TaskRath" }] }),
  component: ChatPage,
  notFoundComponent: () => <div className="p-8 text-sm">ไม่พบห้องสนทนา</div>,
  errorComponent: ({ error }) => <div className="p-8 text-sm text-destructive">{error.message}</div>,
});

const SUGGESTIONS = [
  "ระเบียบการลาป่วยต้องใช้ใบรับรองแพทย์เมื่อใด",
  "ขั้นตอนการจัดซื้อจัดจ้างวิธีเฉพาะเจาะจง",
  "การเบิกค่าใช้จ่ายในการเดินทางไปราชการ",
  "สรุปหลักเกณฑ์การประเมินผลการปฏิบัติงาน",
];

function ChatPage() {
  const { threadId } = Route.useParams();
  const { lang } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchThreads = useServerFn(listChatThreads);
  const fetchThread = useServerFn(getChatThread);
  const createThreadFn = useServerFn(createChatThread);
  const deleteThreadFn = useServerFn(deleteChatThread);
  const renameThreadFn = useServerFn(renameChatThread);
  const sendFn = useServerFn(sendChatMessage);

  const threadsQ = useQuery({
    queryKey: ["chatThreads"],
    queryFn: () => fetchThreads(),
  });

  const threadQ = useQuery({
    queryKey: ["chatThread", threadId],
    queryFn: () => fetchThread({ data: { id: threadId } }),
  });

  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Optimistic local messages (user msg shown immediately)
  const [pendingUser, setPendingUser] = useState<string | null>(null);

  const sendMut = useMutation({
    mutationFn: (text: string) => sendFn({ data: { threadId, message: text } }),
    onSuccess: () => {
      setPendingUser(null);
      qc.invalidateQueries({ queryKey: ["chatThread", threadId] });
      qc.invalidateQueries({ queryKey: ["chatThreads"] });
    },
    onError: (e) => {
      setPendingUser(null);
      toast.error(e instanceof Error ? e.message : "ส่งข้อความไม่สำเร็จ");
    },
  });

  const createMut = useMutation({
    mutationFn: () => createThreadFn({ data: {} }),
    onSuccess: ({ thread }) => {
      qc.invalidateQueries({ queryKey: ["chatThreads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: thread.id } });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteThreadFn({ data: { id } }),
    onSuccess: async (_, id) => {
      const remaining = threadsQ.data?.threads.filter((t) => t.id !== id) ?? [];
      qc.invalidateQueries({ queryKey: ["chatThreads"] });
      if (id === threadId) {
        if (remaining.length > 0) {
          navigate({ to: "/chat/$threadId", params: { threadId: remaining[0].id } });
        } else {
          const { thread } = await createThreadFn({ data: {} });
          navigate({ to: "/chat/$threadId", params: { threadId: thread.id } });
        }
      }
    },
  });

  const renameMut = useMutation({
    mutationFn: (vars: { id: string; title: string }) => renameThreadFn({ data: vars }),
    onSuccess: () => {
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["chatThreads"] });
      qc.invalidateQueries({ queryKey: ["chatThread", threadId] });
    },
  });

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [threadQ.data?.messages.length, pendingUser, sendMut.isPending]);

  // Focus input on thread change
  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId]);

  const handleSend = (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || sendMut.isPending) return;
    setInput("");
    setPendingUser(value);
    sendMut.mutate(value);
  };

  const messages = threadQ.data?.messages ?? [];
  const showEmpty = messages.length === 0 && !pendingUser;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Thread sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:flex md:flex-col">
        <div className="p-3">
          <Button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            className="w-full justify-start"
            size="sm"
            variant="outline"
          >
            <Plus className="mr-2 h-4 w-4" />
            {lang === "th" ? "สนทนาใหม่" : "New chat"}
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {threadsQ.data?.threads.map((t) => (
            <ThreadRow
              key={t.id}
              thread={t}
              active={t.id === threadId}
              editing={editingId === t.id}
              editTitle={editTitle}
              onSelect={() => navigate({ to: "/chat/$threadId", params: { threadId: t.id } })}
              onStartEdit={() => { setEditingId(t.id); setEditTitle(t.title); }}
              onCancelEdit={() => setEditingId(null)}
              onChangeTitle={setEditTitle}
              onSaveEdit={() => renameMut.mutate({ id: t.id, title: editTitle.trim() || t.title })}
              onDelete={() => deleteMut.mutate(t.id)}
            />
          ))}
        </div>
      </aside>

      {/* Conversation pane */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <BookText className="h-4 w-4 text-primary" />
          <h1 className="text-sm font-semibold">
            {threadQ.data?.thread.title ?? (lang === "th" ? "ถาม-ตอบ Knowledge Base" : "KB Chat")}
          </h1>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {showEmpty && (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
                <MessageSquare className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  {lang === "th" ? "ถามคำถามเกี่ยวกับระเบียบราชการที่อัปโหลดไว้" : "Ask about uploaded regulations"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lang === "th"
                    ? "ระบบจะค้นหาจากเอกสาร KB และตอบพร้อมอ้างอิงแหล่งที่มา"
                    : "Answers are grounded in the KB with citations"}
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="rounded-md border border-border bg-background px-3 py-2 text-left text-xs hover:bg-muted"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}

            {pendingUser && (
              <MessageBubble
                message={{
                  id: "pending-user",
                  thread_id: threadId,
                  role: "user",
                  content: pendingUser,
                  citations: [],
                  created_at: new Date().toISOString(),
                }}
              />
            )}

            {sendMut.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {lang === "th" ? "กำลังค้นหาและคิดคำตอบ…" : "Searching KB…"}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-card p-3">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={lang === "th" ? "พิมพ์คำถาม… (Shift+Enter เพื่อขึ้นบรรทัดใหม่)" : "Ask a question…"}
              rows={2}
              className="resize-none"
              disabled={sendMut.isPending}
            />
            <VoiceInputButton
              size="icon"
              onTranscript={(text, isFinal) => {
                if (!isFinal) return;
                setInput((p) => (p ? p + " " : "") + text);
              }}
            />
            <Button onClick={() => handleSend()} disabled={!input.trim() || sendMut.isPending} size="icon">
              {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : ""}>
      <div className={isUser ? "max-w-[80%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground" : "max-w-full"}>
        <div className={isUser ? "whitespace-pre-wrap" : "prose prose-sm max-w-none whitespace-pre-wrap text-foreground"}>
          {message.content}
        </div>
        {!isUser && message.citations && message.citations.length > 0 && (
          <CitationsList citations={message.citations} />
        )}
      </div>
    </div>
  );
}

function ThreadRow({
  thread, active, editing, editTitle,
  onSelect, onStartEdit, onCancelEdit, onChangeTitle, onSaveEdit, onDelete,
}: {
  thread: ChatThread;
  active: boolean;
  editing: boolean;
  editTitle: string;
  onSelect: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onChangeTitle: (v: string) => void;
  onSaveEdit: () => void;
  onDelete: () => void;
}) {
  if (editing) {
    return (
      <div className="flex items-center gap-1 rounded-md px-2 py-1.5">
        <Input
          autoFocus
          value={editTitle}
          onChange={(e) => onChangeTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSaveEdit();
            if (e.key === "Escape") onCancelEdit();
          }}
          onBlur={onSaveEdit}
          className="h-7 text-xs"
        />
      </div>
    );
  }
  return (
    <div
      className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-xs ${
        active ? "bg-accent text-accent-foreground" : "hover:bg-muted"
      }`}
    >
      <button onClick={onSelect} className="flex-1 truncate text-left">
        {thread.title}
      </button>
      <button
        onClick={onStartEdit}
        className="opacity-0 transition-opacity group-hover:opacity-100"
        aria-label="Rename"
      >
        <Pencil className="h-3 w-3" />
      </button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button className="opacity-0 transition-opacity group-hover:opacity-100" aria-label="Delete">
            <Trash2 className="h-3 w-3 text-destructive" />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบห้องสนทนา?</AlertDialogTitle>
            <AlertDialogDescription>
              ข้อความทั้งหมดในห้อง "{thread.title}" จะถูกลบและไม่สามารถกู้คืนได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>ลบ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Suppress unused import warning for Link (kept for possible future use)
void Link;
void notFound;
