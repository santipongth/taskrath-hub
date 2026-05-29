import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listKbDocuments,
  uploadKbDocument,
  deleteKbDocument,
  searchKb,
} from "@/lib/kb.functions";
import { checkIsAdmin } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookText, Trash2, Upload, Search, Loader2, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/knowledge")({
  head: () => ({ meta: [{ title: "Knowledge Base · TaskRath" }] }),
  component: KnowledgePage,
});

const CATEGORIES = [
  { value: "regulation", label: "ระเบียบ" },
  { value: "circular", label: "หนังสือเวียน" },
  { value: "manual", label: "คู่มือ" },
  { value: "law", label: "กฎหมาย" },
  { value: "other", label: "อื่นๆ" },
];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function fileToText(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsText(file);
  });
}

function KnowledgePage() {
  const qc = useQueryClient();
  const fetchIsAdmin = useServerFn(checkIsAdmin);
  const fetchList = useServerFn(listKbDocuments);
  const doUpload = useServerFn(uploadKbDocument);
  const doDelete = useServerFn(deleteKbDocument);
  const doSearch = useServerFn(searchKb);

  const { data: adminData, isLoading: adminLoading } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => fetchIsAdmin(),
  });
  const { data: list } = useQuery({
    queryKey: ["kb-docs"],
    queryFn: () => fetchList(),
    refetchInterval: (q) => {
      const docs = (q.state.data as { documents?: { status: string }[] } | undefined)?.documents ?? [];
      return docs.some((d) => d.status === "processing") ? 3000 : false;
    },
  });

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("regulation");
  const [source, setSource] = useState("");
  const [content, setContent] = useState("");
  const [uploading, setUploading] = useState(false);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [matches, setMatches] = useState<any[]>([]);

  if (adminLoading) return <div className="p-8 text-sm text-muted-foreground">…</div>;
  if (!adminData?.isAdmin) throw redirect({ to: "/" });

  const onFile = async (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("ไฟล์ต้องไม่เกิน 10MB");
      return;
    }
    setTitle((t) => t || file.name.replace(/\.[^.]+$/, ""));
    setSource((s) => s || file.name);
    const name = file.name.toLowerCase();
    try {
      if (file.type === "application/pdf" || name.endsWith(".pdf")) {
        const dataUrl = await fileToDataUrl(file);
        setContent(`__PDF__${dataUrl}`);
        toast.success(`โหลด PDF "${file.name}" แล้ว — กดอัปโหลดเพื่อประมวลผล`);
      } else if (
        name.endsWith(".docx") ||
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        const mammoth = (await import("mammoth/mammoth.browser" as string)) as {
          extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
        };

        const buf = await file.arrayBuffer();
        const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
        if (!value.trim()) {
          toast.error("ไม่พบข้อความใน DOCX");
          return;
        }
        setContent(value);
        toast.success(`โหลด DOCX "${file.name}" แล้ว`);
      } else {
        const text = await fileToText(file);
        setContent(text);
        toast.success(`โหลดไฟล์ "${file.name}" แล้ว`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "อ่านไฟล์ไม่สำเร็จ");
    }
  };


  const onUpload = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("กรุณาระบุชื่อและเนื้อหา");
      return;
    }
    setUploading(true);
    try {
      const isPdf = content.startsWith("__PDF__");
      const res = await doUpload({
        data: {
          title: title.trim(),
          category: category as "regulation" | "circular" | "manual" | "law" | "other",
          source: source.trim() || undefined,
          ...(isPdf
            ? { pdfDataUrl: content.slice(7) }
            : { content }),
        },
      });
      toast.success(`บันทึกแล้ว · ${res.chunks} chunks`);
      setTitle("");
      setSource("");
      setContent("");
      qc.invalidateQueries({ queryKey: ["kb-docs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (id: string, title: string) => {
    if (!confirm(`ลบ "${title}"?`)) return;
    try {
      await doDelete({ data: { id } });
      toast.success("ลบแล้ว");
      qc.invalidateQueries({ queryKey: ["kb-docs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const onSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setMatches([]);
    try {
      const res = await doSearch({ data: { query, topK: 5, threshold: 0.2 } });
      setMatches(res.matches);
      if (res.matches.length === 0) toast.info("ไม่พบเอกสารที่ตรง");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const docs = list?.documents ?? [];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-primary">
          <BookText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">
            อัปโหลดระเบียบ หนังสือเวียน คู่มือ ให้ AI อ้างอิงทุกครั้งที่รัน
          </p>
        </div>
      </div>

      {/* Upload */}
      <section className="mb-8 rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Upload className="h-4 w-4" />
          เพิ่มเอกสารใหม่
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">ชื่อเอกสาร *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ระเบียบสำนักนายกฯ ว่าด้วยงานสารบรรณ" />
          </div>
          <div>
            <Label className="text-xs">หมวด</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">ที่มา (URL หรือชื่อไฟล์)</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="เช่น https://… หรือชื่อไฟล์" />
          </div>
          <div className="sm:col-span-2">
            <div className="mb-1.5 flex items-center justify-between">
              <Label className="text-xs">เนื้อหา *</Label>
              <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                <input
                  type="file"
                  accept=".txt,.md,.pdf,application/pdf,text/plain,text/markdown"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
                />
                <FileText className="h-3 w-3" />
                อัปโหลดไฟล์ (.txt .md .pdf · ≤10MB)
              </label>
            </div>
            <Textarea
              rows={8}
              value={content.startsWith("__PDF__") ? "[PDF binary loaded — กดอัปโหลดเพื่อให้ AI ดึงข้อความ]" : content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="วางเนื้อหาเอกสารที่นี่ หรืออัปโหลดไฟล์"
              className="resize-none font-mono text-xs"
              disabled={content.startsWith("__PDF__")}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          {content.startsWith("__PDF__") && (
            <Button variant="ghost" size="sm" onClick={() => setContent("")}>ล้างไฟล์</Button>
          )}
          <Button onClick={onUpload} disabled={uploading || !title.trim() || !content.trim()}>
            {uploading ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />กำลังประมวลผล…</> : "อัปโหลด"}
          </Button>
        </div>
      </section>

      {/* Search test */}
      <section className="mb-8 rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Search className="h-4 w-4" />
          ทดสอบค้นหา
        </h2>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="พิมพ์คำถาม เช่น ระเบียบการเบิกค่าเดินทาง"
            onKeyDown={(e) => { if (e.key === "Enter") onSearch(); }}
          />
          <Button onClick={onSearch} disabled={searching || !query.trim()}>
            {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "ค้น"}
          </Button>
        </div>
        {matches.length > 0 && (
          <div className="mt-4 space-y-2">
            {matches.map((m, i) => (
              <div key={m.id} className="rounded border border-border bg-background p-3 text-xs">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold">[{i + 1}] {m.title}</span>
                  <Badge variant="secondary" className="text-[10px]">{Math.round(m.similarity * 100)}%</Badge>
                </div>
                <p className="whitespace-pre-wrap text-muted-foreground">{m.content.slice(0, 400)}{m.content.length > 400 && "…"}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Documents list */}
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold">เอกสารทั้งหมด ({docs.length})</h2>
        {docs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีเอกสาร</p>
        ) : (
          <div className="divide-y divide-border">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{d.title}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {CATEGORIES.find((c) => c.value === d.category)?.label ?? d.category}
                    </Badge>
                    {d.status === "processing" && (
                      <Badge variant="secondary" className="text-[10px]"><Loader2 className="mr-1 h-2.5 w-2.5 animate-spin" />กำลังประมวลผล</Badge>
                    )}
                    {d.status === "ready" && (
                      <Badge variant="secondary" className="text-[10px]">{d.chunk_count} chunks</Badge>
                    )}
                    {d.status === "failed" && (
                      <Badge variant="destructive" className="text-[10px]"><AlertCircle className="mr-1 h-2.5 w-2.5" />ล้มเหลว</Badge>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    {d.source && <span className="truncate">{d.source}</span>}
                    <span>· {new Date(d.created_at).toLocaleString("th-TH")}</span>
                    {d.error && <span className="text-destructive">· {d.error}</span>}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onDelete(d.id, d.title)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
