import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { runFreeform, ocrAttachments, compareFreeform, listMyDeptModels } from "@/lib/ai.functions";
import { listMySkills, seedDefaultSkills } from "@/lib/user-skills.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Sparkles, Copy, Paperclip, X, FileText, Image as ImageIcon, FileType2, AlertTriangle, GitCompare, UserCog, Plus, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { VoiceInputButton } from "@/components/voice-input-button";
import logo from "@/assets/rathcowork-icon.png.asset.json";

export const Route = createFileRoute("/_authenticated/run/")({
  head: () => ({ meta: [{ title: "สั่งงาน AI · RathCoWork" }] }),
  component: RunPage,
});

type Attachment = {
  name: string;
  kind: "image" | "pdf" | "text";
  data: string;
  mime?: string;
  size: number;
  pages?: number;
  textLen?: number;
};

type CompareItem =
  | { selector: string; ok: true; output: string; usage: { promptTokens: number; completionTokens: number; costUsd: number }; provider: { id: string; kind: string }; latency_ms: number }
  | { selector: string; ok: false; error: string; latency_ms: number };

const MAX_FILES = 8;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|yaml|yml|log|html?|css|js|ts|tsx|jsx|py|sql)$/i;
const MAX_PDF_PAGES = 40;
const DEFAULT_MODEL_KEY = "__default__";

const readAsDataUrl = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
const readAsText = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(f); });
const readAsArrayBuf = (f: File) => new Promise<ArrayBuffer>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.onerror = () => rej(r.error); r.readAsArrayBuffer(f); });

function estimatePdfPages(buf: ArrayBuffer): number {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  const matches = s.match(/\/Type\s*\/Page(?!s)/g);
  return matches?.length ?? 0;
}

function RunPage() {
  const { t, lang } = useI18n();
  const run = useServerFn(runFreeform);
  const ocr = useServerFn(ocrAttachments);
  const compare = useServerFn(compareFreeform);
  const fetchModels = useServerFn(listMyDeptModels);
  const fetchSkills = useServerFn(listMySkills);
  const seedSkills = useServerFn(seedDefaultSkills);

  const { data: modelsData } = useQuery({
    queryKey: ["my-dept-models"],
    queryFn: () => fetchModels(),
    staleTime: 5 * 60 * 1000,
  });
  const models = modelsData?.models ?? [];
  const { data: skillsData, refetch: refetchSkills } = useQuery({
    queryKey: ["user-skills"],
    queryFn: () => fetchSkills(),
  });
  const skills = skillsData?.skills ?? [];

  // Auto-seed curated default skills on first visit if the user has none.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (!skillsData) return;
    if (skillsData.skills.length > 0) return;
    seededRef.current = true;
    seedSkills().then(() => refetchSkills()).catch(() => {});
  }, [skillsData, seedSkills, refetchSkills]);

  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [confirmedWarnings, setConfirmedWarnings] = useState(false);
  const [providerSelector, setProviderSelector] = useState<string>(DEFAULT_MODEL_KEY);
  const [personalSkillId, setPersonalSkillId] = useState<string>("__none__");
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareResults, setCompareResults] = useState<CompareItem[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const baseRef = useRef("");

  const selectedSkill = useMemo(() => skills.find((s) => s.id === personalSkillId) ?? null, [skills, personalSkillId]);

  // Prefill from /tasks "ทำเลย"
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("run:prefill");
      if (!raw) return;
      sessionStorage.removeItem("run:prefill");
      const { prompt: p, skillId } = JSON.parse(raw) as { prompt?: string; skillId?: string };
      if (p) { setPrompt(p); baseRef.current = p; }
      if (skillId) setPersonalSkillId(skillId);
    } catch { /* ignore */ }
  }, []);

  const warnings = useMemo(() => {
    const w: string[] = [];
    for (const a of attachments) {
      if (a.size === 0) w.push(`${a.name}: ${lang === "th" ? "ไฟล์ว่าง/เสียหาย" : "empty/corrupt"}`);
      if (a.kind === "pdf" && a.pages !== undefined) {
        if (a.pages === 0) w.push(`${a.name}: ${lang === "th" ? "อ่านจำนวนหน้า PDF ไม่ได้ อาจเสียหาย" : "cannot read PDF pages"}`);
        else if (a.pages > MAX_PDF_PAGES) w.push(`${a.name}: ${lang === "th" ? `จำนวนหน้ามาก (${a.pages}) อาจใช้เวลานาน/โทเคนสูง` : `large (${a.pages} pages)`}`);
      }
      if (a.kind === "text" && (a.textLen ?? 0) < 20) w.push(`${a.name}: ${lang === "th" ? "ข้อความน้อยเกินไป" : "text too short"}`);
    }
    if (attachments.filter((a) => a.kind === "image").length > 5) w.push(lang === "th" ? "มีรูปภาพหลายไฟล์ อาจใช้เวลาประมวลผลนาน" : "many images attached");
    return w;
  }, [attachments, lang]);

  const onVoice = (chunk: string, isFinal: boolean) => {
    const sep = baseRef.current && !baseRef.current.endsWith(" ") ? " " : "";
    if (isFinal) { baseRef.current = (baseRef.current + sep + chunk).trimStart(); setPrompt(baseRef.current); }
    else setPrompt((baseRef.current + sep + chunk).trimStart());
  };

  const onFilesPicked = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setConfirmedWarnings(false);
    const next: Attachment[] = [...attachments];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_FILES) { toast.error(lang === "th" ? `แนบได้สูงสุด ${MAX_FILES} ไฟล์` : `Max ${MAX_FILES} files`); break; }
      if (file.size === 0) { toast.error(`${file.name}: ${lang === "th" ? "ไฟล์ว่าง/เสียหาย" : "empty/corrupt"}`); continue; }
      if (file.size > MAX_FILE_BYTES) { toast.error(`${file.name}: ${lang === "th" ? "ไฟล์ใหญ่เกิน 10MB" : "exceeds 10MB"}`); continue; }
      try {
        const mime = file.type || "";
        let kind: Attachment["kind"];
        let data: string;
        let pages: number | undefined;
        let textLen: number | undefined;
        if (mime.startsWith("image/")) {
          kind = "image"; data = await readAsDataUrl(file);
        } else if (mime === "application/pdf" || /\.pdf$/i.test(file.name)) {
          kind = "pdf";
          const buf = await readAsArrayBuf(file);
          pages = estimatePdfPages(buf);
          let bin = ""; const u8 = new Uint8Array(buf);
          for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
          data = `data:application/pdf;base64,${btoa(bin)}`;
        } else if (mime.startsWith("text/") || TEXT_EXT.test(file.name) || mime === "application/json") {
          kind = "text"; data = await readAsText(file); textLen = data.length;
        } else {
          toast.error(`${file.name}: ${lang === "th" ? "ชนิดไฟล์ไม่รองรับ" : "unsupported type"}`); continue;
        }
        next.push({ name: file.name, kind, data, mime, size: file.size, pages, textLen });
      } catch {
        toast.error(`${file.name}: ${lang === "th" ? "อ่านไฟล์ไม่สำเร็จ" : "read failed"}`);
      }
    }
    setAttachments(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (i: number) => { setAttachments(attachments.filter((_, idx) => idx !== i)); setConfirmedWarnings(false); };

  const [ocrWarnings, setOcrWarnings] = useState<string[]>([]);

  const assessOcrQuality = (name: string, text: string): string | null => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return lang === "th" ? `${name}: ถอดข้อความไม่ได้เลย — ไฟล์อาจพร่ามัว/ว่าง` : `${name}: no text extracted`;
    if (trimmed.length < 30) return lang === "th" ? `${name}: ถอดข้อความได้สั้นมาก (${trimmed.length} ตัวอักษร)` : `${name}: very little text (${trimmed.length} chars)`;
    const garbled = (trimmed.match(/[\uFFFD\u0000-\u0008\u000E-\u001F]/g) ?? []).length;
    if (garbled / trimmed.length > 0.05) return lang === "th" ? `${name}: ผลถอดข้อความมีอักขระผิดปกติจำนวนมาก` : `${name}: many garbled characters`;
    const wordy = (trimmed.match(/[\p{L}\p{N}]/gu) ?? []).length;
    if (wordy / trimmed.length < 0.3) return lang === "th" ? `${name}: เนื้อความส่วนใหญ่ไม่ใช่ตัวอักษร` : `${name}: low letter density`;
    return null;
  };

  const toggleCompareId = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) { toast.error(lang === "th" ? "เลือกได้สูงสุด 4 โมเดล" : "Max 4 models"); return prev; }
      return [...prev, id];
    });
  };

  const onCompare = async () => {
    if (!prompt.trim()) { toast.error(lang === "th" ? "กรอกคำสั่งก่อน" : "Enter a prompt"); return; }
    if (compareIds.length < 2) { toast.error(lang === "th" ? "เลือกอย่างน้อย 2 โมเดล" : "Pick at least 2 models"); return; }
    setLoading(true); setCompareResults(null); setOutput("");
    try {
      const res = await compare({ data: { prompt: prompt.trim(), selectors: compareIds.map((id) => `provider:${id}`) } });
      setCompareResults(res.results as CompareItem[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const onRun = async () => {
    if (compareMode) { void onCompare(); return; }
    if (!prompt.trim() && attachments.length === 0) return;
    if (warnings.length > 0 && !confirmedWarnings) {
      toast.warning(lang === "th" ? "พบคำเตือน — กด Run อีกครั้งเพื่อดำเนินการต่อ" : "Warnings — click Run again to continue");
      setConfirmedWarnings(true);
      return;
    }

    let workAtts = attachments;
    const targets = attachments.filter((a) => a.kind === "image" || a.kind === "pdf");
    if (targets.length > 0) {
      setOcrLoading(true);
      try {
        const res = await ocr({ data: { items: targets.map((a) => ({ name: a.name, dataUrl: a.data })) } });
        const map = new Map(res.results.map((r) => [r.name, r] as const));
        const newOcrWarnings: string[] = [];
        workAtts = attachments.map((a) => {
          if (a.kind !== "image" && a.kind !== "pdf") return a;
          const o = map.get(a.name);
          if (!o || o.error) {
            newOcrWarnings.push(lang === "th" ? `${a.name}: OCR ล้มเหลว (${o?.error ?? "ไม่ทราบสาเหตุ"})` : `${a.name}: OCR failed`);
            return a;
          }
          const issue = assessOcrQuality(a.name, o.text);
          if (issue) newOcrWarnings.push(issue);
          return { ...a, kind: "text" as const, data: o.text, mime: "text/plain", size: o.text.length, textLen: o.text.length };
        });
        setAttachments(workAtts);
        setOcrWarnings(newOcrWarnings);
        setOcrLoading(false);
        if (newOcrWarnings.length > 0 && !confirmedWarnings) {
          toast.warning(lang === "th" ? "OCR มีคำเตือนคุณภาพ — กด Run อีกครั้งเพื่อรันต่อ" : "OCR quality warnings");
          setConfirmedWarnings(true);
          return;
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "OCR error"); setOcrLoading(false); return;
      }
    }

    setLoading(true); setOutput(""); setCompareResults(null);
    try {
      const selector = providerSelector !== DEFAULT_MODEL_KEY ? `provider:${providerSelector}` : null;
      const res = await run({
        data: {
          prompt: prompt.trim() || (lang === "th" ? "ช่วยวิเคราะห์/สรุปไฟล์แนบ" : "Please analyze the attached files"),
          attachments: workAtts.map(({ name, kind, data, mime, size }) => ({ name, kind, data, mime, size })),
          providerSelector: selector,
          personalSkillId: personalSkillId !== "__none__" ? personalSkillId : null,
        },
      });
      setOutput(res.output);
      setConfirmedWarnings(false);
      setOcrWarnings([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const downloadOutput = () => {
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `ai-output-${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const iconFor = (k: Attachment["kind"]) =>
    k === "image" ? <ImageIcon className="h-3.5 w-3.5" /> : k === "pdf" ? <FileType2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />;
  const fmtSize = (b: number) => (b < 1024 ? `${b}B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)}KB` : `${(b / 1024 / 1024).toFixed(1)}MB`);
  const nameOf = (id: string) => models.find((m) => m.id === id)?.name ?? id.slice(0, 8);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {/* Hero: centered logo + title */}
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <img src={logo.url} alt="RathCoWork" className="h-12 w-auto object-contain" />
        <p className="max-w-xl text-sm text-muted-foreground">{t("freeformDesc")}</p>
      </div>

      {/* Grok-style pill composer */}
      <div
        className="rounded-3xl border border-border bg-card px-4 pt-3 pb-2 shadow-sm transition-colors focus-within:border-primary/40"
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); if (!compareMode) onFilesPicked(e.dataTransfer.files); }}
      >
        <Textarea
          value={prompt}
          onChange={(e) => { baseRef.current = e.target.value; setPrompt(e.target.value); }}
          placeholder={lang === "th" ? "วันนี้ให้ช่วยอะไรดี?" : "How can I help you today?"}
          rows={2}
          className="min-h-[44px] resize-none border-0 bg-transparent px-1 py-1 text-base shadow-none focus-visible:ring-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !compareMode) {
              e.preventDefault();
              onRun();
            }
          }}
        />

        {!compareMode && attachments.length > 0 && (
          <div className="mt-1 mb-1 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs">
                {iconFor(a.kind)}
                <span className="max-w-[180px] truncate">{a.name}</span>
                <span className="text-muted-foreground">
                  · {fmtSize(a.size)}{a.kind === "pdf" && a.pages !== undefined ? ` · ${a.pages}p` : ""}
                </span>
                <button onClick={() => removeAttachment(i)} className="ml-1 text-muted-foreground hover:text-foreground" aria-label="remove">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {compareMode && (
          <div className="mt-1 mb-1 flex flex-wrap gap-1.5">
            {models.length === 0 && (
              <span className="text-xs text-muted-foreground">
                {lang === "th" ? "ยังไม่มีโมเดลของหน่วยงาน — แจ้งผู้ดูแลเพิ่ม provider" : "No dept models — ask admin"}
              </span>
            )}
            {models.map((m) => {
              const active = compareIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggleCompareId(m.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${active ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,text/*,.md,.csv,.tsv,.json,.xml,.yaml,.yml,.log,.html,.htm,.sql"
          className="hidden"
          onChange={(e) => onFilesPicked(e.target.files)}
        />

        {/* Bottom action row: + (left)  /  model + voice + send (right) */}
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  disabled={loading || ocrLoading}
                  aria-label={lang === "th" ? "ตัวเลือก" : "Options"}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60">
                <DropdownMenuItem
                  onSelect={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
                  disabled={compareMode}
                >
                  <Paperclip className="mr-2 h-4 w-4" />
                  {lang === "th" ? "แนบไฟล์" : "Attach file"}
                </DropdownMenuItem>
                <DropdownMenuCheckboxItem
                  checked={compareMode}
                  onCheckedChange={(v) => { setCompareMode(Boolean(v)); setCompareResults(null); }}
                >
                  <GitCompare className="mr-2 h-4 w-4" />
                  {lang === "th" ? "โหมดเทียบโมเดล" : "Compare models"}
                </DropdownMenuCheckboxItem>

                {skills.length > 0 && !compareMode && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="flex items-center gap-2 text-xs">
                      <UserCog className="h-3.5 w-3.5" /> Skill
                    </DropdownMenuLabel>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <span className="truncate">
                          {selectedSkill ? selectedSkill.name : (lang === "th" ? "— ไม่ใช้ Skill —" : "— No skill —")}
                        </span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                          <DropdownMenuItem onSelect={() => setPersonalSkillId("__none__")}>
                            {lang === "th" ? "— ไม่ใช้ Skill —" : "— No skill —"}
                          </DropdownMenuItem>
                          {skills.map((s) => (
                            <DropdownMenuItem key={s.id} onSelect={() => setPersonalSkillId(s.id)}>
                              {s.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Active-state pills */}
            {!compareMode && selectedSkill && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-foreground">
                <UserCog className="h-3 w-3" />
                {selectedSkill.name}
                <button
                  onClick={() => setPersonalSkillId("__none__")}
                  className="ml-0.5 text-muted-foreground hover:text-foreground"
                  aria-label="clear skill"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {compareMode && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-foreground">
                <GitCompare className="h-3 w-3" />
                {lang === "th" ? `เทียบ ${compareIds.length}/4` : `Compare ${compareIds.length}/4`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {!compareMode && (
              <Select value={providerSelector} onValueChange={setProviderSelector}>
                <SelectTrigger className="h-8 w-auto min-w-[140px] gap-1 border-0 bg-transparent px-2 text-xs shadow-none hover:bg-muted focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value={DEFAULT_MODEL_KEY}>{lang === "th" ? "ค่าเริ่มต้น (Gemini)" : "Default (Gemini)"}</SelectItem>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <VoiceInputButton onTranscript={onVoice} />
            <Button
              onClick={onRun}
              disabled={loading || ocrLoading || (!prompt.trim() && attachments.length === 0) || (compareMode && compareIds.length < 2)}
              size="icon"
              className="h-9 w-9 rounded-full"
              aria-label={t("run")}
            >
              {ocrLoading || loading ? (
                <span className="h-3 w-3 animate-pulse rounded-sm bg-primary-foreground" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Warnings (below composer) */}
      {!compareMode && warnings.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
          <div className="mb-1 flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            {lang === "th" ? "คำเตือนก่อนรัน" : "Pre-run warnings"}
          </div>
          <ul className="ml-5 list-disc space-y-0.5">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {!compareMode && ocrWarnings.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
          <div className="mb-1 flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            {lang === "th" ? "คุณภาพผลลัพธ์ OCR" : "OCR quality"}
          </div>
          <ul className="ml-5 list-disc space-y-0.5">
            {ocrWarnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {compareMode && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {lang === "th"
            ? `เลือก 2–4 โมเดลจากแถบด้านบน — เลือกแล้ว ${compareIds.length}`
            : `Pick 2–4 models above — ${compareIds.length} selected`}
        </p>
      )}

      {compareResults && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {compareResults.map((r, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <div className="font-medium text-foreground">{nameOf(r.selector.replace(/^provider:/, ""))}</div>
                <div className="text-muted-foreground">{r.latency_ms}ms</div>
              </div>
              {r.ok ? (
                <>
                  <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap text-sm text-foreground">{r.output}</pre>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>tok: {r.usage.promptTokens}+{r.usage.completionTokens}</span>
                    <span>${r.usage.costUsd.toFixed(5)}</span>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => { navigator.clipboard.writeText(r.output); toast.success(t("copied")); }}>
                      <Copy className="mr-1 h-3 w-3" />{t("copy")}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-sm text-destructive">{r.error}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {output && (
        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("result")}</h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(output); toast.success(t("copied")); }}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />{t("copy")}
              </Button>
              <Button variant="ghost" size="sm" onClick={downloadOutput}>
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                {lang === "th" ? "ดาวน์โหลด .txt" : "Download .txt"}
              </Button>
            </div>
          </div>
          <pre className="whitespace-pre-wrap text-sm text-foreground">{output}</pre>
        </div>
      )}
    </div>
  );
}
