import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, FolderKanban, Link as LinkIcon, FileText, StickyNote,
  Telescope, Sparkles, Plus, Trash2, ExternalLink, BookOpen, Wand2, Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";
import { listMyProjects } from "@/lib/user-projects.functions";
import {
  listProjectSources, upsertProjectSource, deleteProjectSource,
  listProjectNotes, upsertProjectNote, deleteProjectNote,
  type ProjectSource, type ProjectNote,
} from "@/lib/project-sources.functions";
import {
  listMyTransformations, upsertTransformation, deleteTransformation, applyTransformation,
  type Transformation,
} from "@/lib/transformations.functions";
import { embedSource, reindexProject } from "@/lib/source-embeddings.functions";
import { NotebookChat } from "@/components/notebook/notebook-chat";
import { AudioBrief } from "@/components/notebook/audio-brief";
import { MarkdownEditor } from "@/components/notebook/markdown-editor";
import { Loader2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  head: () => ({ meta: [{ title: "Notebook · RathCoWork" }] }),
  component: ProjectHubPage,
});

function ProjectHubPage() {
  const { projectId } = Route.useParams();
  const { lang } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const listProjects = useServerFn(listMyProjects);
  const listSources = useServerFn(listProjectSources);
  const listNotes = useServerFn(listProjectNotes);
  const upsertSource = useServerFn(upsertProjectSource);
  const removeSource = useServerFn(deleteProjectSource);
  const upsertNote = useServerFn(upsertProjectNote);
  const removeNote = useServerFn(deleteProjectNote);
  const listTfs = useServerFn(listMyTransformations);
  const upsertTf = useServerFn(upsertTransformation);
  const removeTf = useServerFn(deleteTransformation);
  const applyTf = useServerFn(applyTransformation);

  const { data: projData } = useQuery({
    queryKey: ["my-projects"],
    queryFn: () => listProjects(),
  });
  const project = projData?.projects.find((p) => p.id === projectId);

  const { data: srcData, isLoading: srcLoading } = useQuery({
    queryKey: ["project-sources", projectId],
    queryFn: () => listSources({ data: { projectId } }),
  });
  const { data: noteData, isLoading: noteLoading } = useQuery({
    queryKey: ["project-notes", projectId],
    queryFn: () => listNotes({ data: { projectId } }),
  });
  const { data: tfData } = useQuery({
    queryKey: ["my-transformations"],
    queryFn: () => listTfs(),
  });

  const sources = srcData?.sources ?? [];
  const notes = noteData?.notes ?? [];
  const transformations = tfData?.transformations ?? [];

  const applyTfMut = useMutation({
    mutationFn: (vars: { transformation_id: string; source_id: string }) =>
      applyTf({ data: { ...vars, save_as_note: true } }),
    onSuccess: async () => {
      toast.success(lang === "th" ? "บันทึกผลเป็นโน้ตแล้ว" : "Saved as note");
      await qc.invalidateQueries({ queryKey: ["project-notes", projectId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  // Add source dialog
  const [openSrc, setOpenSrc] = useState(false);
  const [srcKind, setSrcKind] = useState<"url" | "text">("url");
  const [srcTitle, setSrcTitle] = useState("");
  const [srcUrl, setSrcUrl] = useState("");
  const [srcText, setSrcText] = useState("");

  const embedSrcFn = useServerFn(embedSource);
  const reindexFn = useServerFn(reindexProject);

  const addSource = useMutation({
    mutationFn: async () => {
      const r = await upsertSource({
        data: {
          project_id: projectId,
          kind: srcKind,
          title: srcTitle.trim() || (srcKind === "url" ? srcUrl : "Untitled"),
          url: srcKind === "url" ? srcUrl.trim() : null,
          content_md: srcKind === "text" ? srcText : null,
        },
      });
      // Best-effort: embed text sources for semantic Ask. URL sources have no body yet.
      if (srcKind === "text" && srcText.trim()) {
        try { await embedSrcFn({ data: { source_id: r.id } }); } catch { /* ignore */ }
      }
      return r;
    },
    onSuccess: async () => {
      toast.success(lang === "th" ? "เพิ่มแหล่งแล้ว" : "Source added");
      setOpenSrc(false); setSrcTitle(""); setSrcUrl(""); setSrcText("");
      await qc.invalidateQueries({ queryKey: ["project-sources", projectId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const reindexMut = useMutation({
    mutationFn: () => reindexFn({ data: { project_id: projectId } }),
    onSuccess: (r) =>
      toast.success(
        lang === "th"
          ? `Re-index แล้ว: ${r.sources} แหล่ง / ${r.chunks} ชิ้น`
          : `Re-indexed: ${r.sources} sources / ${r.chunks} chunks`,
      ),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const deleteSrc = useMutation({
    mutationFn: (id: string) => removeSource({ data: { id } }),
    onSuccess: async () => {
      toast.success(lang === "th" ? "ลบแล้ว" : "Deleted");
      await qc.invalidateQueries({ queryKey: ["project-sources", projectId] });
    },
  });


  // Add note dialog
  const [openNote, setOpenNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  const addNote = useMutation({
    mutationFn: () =>
      upsertNote({
        data: {
          project_id: projectId,
          title: noteTitle.trim() || "Untitled",
          content_md: noteContent,
          origin: "manual",
        },
      }),
    onSuccess: async () => {
      toast.success(lang === "th" ? "บันทึกโน้ตแล้ว" : "Note saved");
      setOpenNote(false); setNoteTitle(""); setNoteContent("");
      await qc.invalidateQueries({ queryKey: ["project-notes", projectId] });
    },
  });

  const deleteNoteMut = useMutation({
    mutationFn: (id: string) => removeNote({ data: { id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["project-notes", projectId] });
    },
  });

  // Quick actions — prefill /run and /research
  const sendToRun = () => {
    try {
      const ctx = sources
        .map((s) => `### ${s.title}\n${s.url ? `URL: ${s.url}\n` : ""}${s.content_md ?? ""}`)
        .join("\n\n---\n\n");
      sessionStorage.setItem(
        "run:prefill",
        JSON.stringify({ prompt: ctx, projectId }),
      );
    } catch { /* ignore */ }
    navigate({ to: "/run" });
  };

  const sendToResearch = () => {
    const urls = sources.filter((s) => s.kind === "url" && s.url).map((s) => s.url).join(" ");
    try {
      if (urls) sessionStorage.setItem("research:urls", urls);
    } catch { /* ignore */ }
    navigate({ to: "/research" });
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link to="/projects" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> {lang === "th" ? "Notebooks ทั้งหมด" : "All notebooks"}
      </Link>

      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <FolderKanban className="h-5 w-5 text-primary" />
            {project?.name ?? (lang === "th" ? "โหลด…" : "Loading…")}
          </h1>
          {project?.context && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.context}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={sendToRun} disabled={sources.length === 0}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />{lang === "th" ? "ใช้กับ AI" : "Use with AI"}
          </Button>
          <Button size="sm" variant="secondary" onClick={sendToResearch}>
            <Telescope className="mr-1.5 h-3.5 w-3.5" />{lang === "th" ? "ทำวิจัย" : "Research"}
          </Button>
          <ManageTransformationsDialog
            transformations={transformations}
            upsert={(v) => upsertTf({ data: v })}
            remove={(id) => removeTf({ data: { id } })}
            onChanged={() => qc.invalidateQueries({ queryKey: ["my-transformations"] })}
            lang={lang}
          />
        </div>
      </div>

      {/* Ask across sources */}
      <section className="mb-6 rounded-lg border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Search className="h-4 w-4 text-primary" />
            {lang === "th" ? "ถามแหล่งข้อมูล (Semantic Ask)" : "Ask your sources"}
          </h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => reindexMut.mutate()}
            disabled={reindexMut.isPending || sources.length === 0}
            title={lang === "th" ? "ประมวลผลทุก source ใหม่" : "Re-embed all sources"}
          >
            {reindexMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
            {lang === "th" ? "Re-index" : "Re-index"}
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && question.trim().length >= 3 && !askMut.isPending) askMut.mutate();
            }}
            placeholder={lang === "th" ? "พิมพ์คำถามเกี่ยวกับเนื้อหาที่อยู่ใน Notebook นี้…" : "Ask anything about this notebook…"}
            className="flex-1"
          />
          <Button onClick={() => askMut.mutate()} disabled={askMut.isPending || question.trim().length < 3}>
            {askMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (lang === "th" ? "ถาม" : "Ask")}
          </Button>
        </div>
        {answer && (
          <div className="mt-3 space-y-2">
            <div className="whitespace-pre-wrap rounded border bg-background p-3 text-sm leading-relaxed">{answer}</div>
            {citations.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {citations.map((c, i) => (
                  <a
                    key={c.source_id}
                    href={c.url ?? "#"}
                    target={c.url ? "_blank" : undefined}
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
                    title={`${Math.round(c.similarity * 100)}% match`}
                  >
                    <span className="font-mono">[{i + 1}]</span>
                    <span className="line-clamp-1 max-w-[200px]">{c.title}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sources */}
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <BookOpen className="h-4 w-4 text-primary" />
              {lang === "th" ? `แหล่งข้อมูล (${sources.length})` : `Sources (${sources.length})`}
            </h2>
            <Dialog open={openSrc} onOpenChange={setOpenSrc}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost"><Plus className="mr-1 h-3.5 w-3.5" />{lang === "th" ? "เพิ่ม" : "Add"}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{lang === "th" ? "เพิ่มแหล่งข้อมูล" : "Add source"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Button size="sm" variant={srcKind === "url" ? "default" : "outline"} onClick={() => setSrcKind("url")}>
                      <LinkIcon className="mr-1 h-3.5 w-3.5" />URL
                    </Button>
                    <Button size="sm" variant={srcKind === "text" ? "default" : "outline"} onClick={() => setSrcKind("text")}>
                      <FileText className="mr-1 h-3.5 w-3.5" />{lang === "th" ? "ข้อความ" : "Text"}
                    </Button>
                  </div>
                  <Input
                    value={srcTitle}
                    onChange={(e) => setSrcTitle(e.target.value)}
                    placeholder={lang === "th" ? "ชื่อ (ไม่ใส่ก็ได้)" : "Title (optional)"}
                  />
                  {srcKind === "url" ? (
                    <Input
                      value={srcUrl}
                      onChange={(e) => setSrcUrl(e.target.value)}
                      placeholder="https://…"
                    />
                  ) : (
                    <Textarea
                      rows={8}
                      value={srcText}
                      onChange={(e) => setSrcText(e.target.value)}
                      placeholder={lang === "th" ? "วางข้อความที่ต้องการเก็บเป็นแหล่ง…" : "Paste text…"}
                    />
                  )}
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpenSrc(false)}>{lang === "th" ? "ยกเลิก" : "Cancel"}</Button>
                  <Button onClick={() => addSource.mutate()} disabled={addSource.isPending || (srcKind === "url" ? !srcUrl.trim() : !srcText.trim())}>
                    {addSource.isPending ? "…" : lang === "th" ? "บันทึก" : "Save"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {srcLoading ? (
            <div className="text-xs text-muted-foreground">{lang === "th" ? "กำลังโหลด…" : "Loading…"}</div>
          ) : sources.length === 0 ? (
            <div className="rounded border border-dashed p-4 text-center text-xs text-muted-foreground">
              {lang === "th" ? "ยังไม่มีแหล่งข้อมูล" : "No sources yet"}
            </div>
          ) : (
            <ul className="space-y-2">
              {sources.map((s) => (
                <SourceRow
                  key={s.id}
                  src={s}
                  onDelete={() => deleteSrc.mutate(s.id)}
                  lang={lang}
                  transformations={transformations}
                  onApply={(tfId) => applyTfMut.mutate({ transformation_id: tfId, source_id: s.id })}
                  applyPending={applyTfMut.isPending}
                />
              ))}
            </ul>
          )}
        </section>

        {/* Notes */}
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <StickyNote className="h-4 w-4 text-primary" />
              {lang === "th" ? `โน้ต (${notes.length})` : `Notes (${notes.length})`}
            </h2>
            <Dialog open={openNote} onOpenChange={setOpenNote}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost"><Plus className="mr-1 h-3.5 w-3.5" />{lang === "th" ? "เพิ่ม" : "Add"}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{lang === "th" ? "เพิ่มโน้ต" : "Add note"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder={lang === "th" ? "ชื่อโน้ต" : "Title"} />
                  <Textarea rows={10} value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="markdown…" />
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpenNote(false)}>{lang === "th" ? "ยกเลิก" : "Cancel"}</Button>
                  <Button onClick={() => addNote.mutate()} disabled={addNote.isPending || !noteContent.trim()}>
                    {addNote.isPending ? "…" : lang === "th" ? "บันทึก" : "Save"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {noteLoading ? (
            <div className="text-xs text-muted-foreground">{lang === "th" ? "กำลังโหลด…" : "Loading…"}</div>
          ) : notes.length === 0 ? (
            <div className="rounded border border-dashed p-4 text-center text-xs text-muted-foreground">
              {lang === "th" ? "ยังไม่มีโน้ต" : "No notes yet"}
            </div>
          ) : (
            <ul className="space-y-2">
              {notes.map((n) => <NoteRow key={n.id} note={n} onDelete={() => deleteNoteMut.mutate(n.id)} lang={lang} />)}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function SourceRow({
  src, onDelete, lang, transformations, onApply, applyPending,
}: {
  src: ProjectSource;
  onDelete: () => void;
  lang: string;
  transformations: Transformation[];
  onApply: (transformationId: string) => void;
  applyPending: boolean;
}) {
  const Icon = src.kind === "url" ? LinkIcon : src.kind === "research" ? Telescope : FileText;
  return (
    <li className="group rounded border border-border bg-background p-2.5">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="line-clamp-1 text-xs font-medium">{src.title}</span>
            {src.url && (
              <a href={src.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          {src.content_md && (
            <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{src.content_md.slice(0, 240)}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="text-muted-foreground hover:text-primary disabled:opacity-50"
                aria-label="apply transformation"
                disabled={applyPending}
                title={lang === "th" ? "ใช้ Transformation" : "Apply transformation"}
              >
                <Wand2 className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-[11px]">
                {lang === "th" ? "เลือก Transformation" : "Choose transformation"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {transformations.length === 0 ? (
                <div className="px-2 py-3 text-[11px] text-muted-foreground">
                  {lang === "th" ? "ยังไม่มี Transformation" : "No transformations"}
                </div>
              ) : (
                transformations.map((t) => (
                  <DropdownMenuItem key={t.id} onClick={() => onApply(t.id)} className="flex flex-col items-start gap-0.5">
                    <span className="text-xs font-medium">{t.name}</span>
                    {t.description && (
                      <span className="line-clamp-1 text-[10px] text-muted-foreground">{t.description}</span>
                    )}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" aria-label="delete">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{lang === "th" ? "ลบแหล่งนี้?" : "Delete this source?"}</AlertDialogTitle>
                <AlertDialogDescription>{src.title}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{lang === "th" ? "ยกเลิก" : "Cancel"}</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>{lang === "th" ? "ลบ" : "Delete"}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </li>
  );
}

function NoteRow({ note, onDelete, lang }: { note: ProjectNote; onDelete: () => void; lang: string }) {
  return (
    <li className="group rounded border border-border bg-background p-2.5">
      <div className="flex items-start gap-2">
        <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="line-clamp-1 text-xs font-medium">{note.title}</span>
            {note.origin !== "manual" && (
              <span className="rounded bg-primary/10 px-1 py-0.5 text-[9px] uppercase tracking-wide text-primary">{note.origin}</span>
            )}
          </div>
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[11px] text-muted-foreground">{note.content_md.slice(0, 400)}</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" aria-label="delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{lang === "th" ? "ลบโน้ต?" : "Delete note?"}</AlertDialogTitle>
              <AlertDialogDescription>{note.title}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{lang === "th" ? "ยกเลิก" : "Cancel"}</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>{lang === "th" ? "ลบ" : "Delete"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}

function ManageTransformationsDialog({
  transformations, upsert, remove, onChanged, lang,
}: {
  transformations: Transformation[];
  upsert: (v: { id?: string; name: string; description?: string | null; prompt: string }) => Promise<{ id: string }>;
  remove: (id: string) => Promise<{ ok: boolean }>;
  onChanged: () => void;
  lang: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transformation | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  const resetForm = () => {
    setEditing(null); setName(""); setDesc(""); setPrompt("");
  };
  const loadInto = (t: Transformation) => {
    setEditing(t); setName(t.name); setDesc(t.description ?? ""); setPrompt(t.prompt);
  };

  const save = async () => {
    if (!name.trim() || !prompt.trim()) return;
    setBusy(true);
    try {
      await upsert({ id: editing?.id, name: name.trim(), description: desc.trim() || null, prompt: prompt.trim() });
      toast.success(lang === "th" ? "บันทึกแล้ว" : "Saved");
      resetForm();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const del = async (id: string) => {
    setBusy(true);
    try {
      await remove(id);
      if (editing?.id === id) resetForm();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
          {lang === "th" ? "Transformations" : "Transformations"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{lang === "th" ? "จัดการ Transformations" : "Manage transformations"}</DialogTitle>
          <DialogDescription>
            {lang === "th"
              ? "Transformation คือคำสั่ง AI สำเร็จรูป (เช่น สรุป / สกัดประเด็น / แปล) ที่ใช้ซ้ำกับแหล่งใดก็ได้"
              : "Reusable AI prompts you can apply to any source."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              {lang === "th" ? `รายการ (${transformations.length})` : `List (${transformations.length})`}
            </div>
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {transformations.map((t) => (
                <li
                  key={t.id}
                  className={`group flex items-start gap-2 rounded border p-2 text-xs ${editing?.id === t.id ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <button className="min-w-0 flex-1 text-left" onClick={() => loadInto(t)}>
                    <div className="font-medium">{t.name}</div>
                    {t.description && <div className="line-clamp-1 text-[10px] text-muted-foreground">{t.description}</div>}
                  </button>
                  <button
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={() => del(t.id)}
                    disabled={busy}
                    aria-label="delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <Button size="sm" variant="ghost" onClick={resetForm} className="w-full">
              <Plus className="mr-1 h-3.5 w-3.5" />{lang === "th" ? "สร้างใหม่" : "New"}
            </Button>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              {editing ? (lang === "th" ? "แก้ไข" : "Edit") : (lang === "th" ? "สร้างใหม่" : "Create")}
            </div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={lang === "th" ? "ชื่อ เช่น สรุปเป็น Bullet" : "Name"} />
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={lang === "th" ? "คำอธิบายสั้น ๆ (ไม่บังคับ)" : "Short description"} />
            <Textarea
              rows={8}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={lang === "th" ? "คำสั่ง AI เช่น 'จงสรุปเนื้อหาด้านล่างเป็น bullet…'" : "Prompt instructions"}
            />
            <div className="flex justify-end gap-2">
              {editing && <Button size="sm" variant="ghost" onClick={resetForm}>{lang === "th" ? "ยกเลิก" : "Cancel"}</Button>}
              <Button size="sm" onClick={save} disabled={busy || !name.trim() || !prompt.trim()}>
                {busy ? "…" : editing ? (lang === "th" ? "อัปเดต" : "Update") : (lang === "th" ? "เพิ่ม" : "Add")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
