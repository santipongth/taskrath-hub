import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Headphones, Loader2, Download, Sparkles, FileText, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { generateAudioBrief, AUDIO_BRIEF_VOICES } from "@/lib/audio-brief.functions";

type Brief = { script: string; audio_base64: string[]; mime: string };

const SPEEDS = [
  { v: 0.85, label: "0.85× ช้า" },
  { v: 0.95, label: "0.95× ค่อนข้างช้า" },
  { v: 1.0, label: "1.0× ปกติ" },
  { v: 1.1, label: "1.1× ค่อนข้างเร็ว" },
  { v: 1.2, label: "1.2× เร็ว" },
];

export function AudioBrief({ projectId, lang, disabled }: { projectId: string; lang: string; disabled: boolean }) {
  const [voice, setVoice] = useState<(typeof AUDIO_BRIEF_VOICES)[number]>("alloy");
  const [style, setStyle] = useState<"brief" | "podcast">("brief");
  const [tone, setTone] = useState<"formal" | "semi_formal">("semi_formal");
  const [speed, setSpeed] = useState<number>(1.0);
  const [script, setScript] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const genFn = useServerFn(generateAudioBrief);

  const audioUrls = useMemo(() => {
    if (!brief) return [];
    return brief.audio_base64.map((b64) => `data:${brief.mime};base64,${b64}`);
  }, [brief]);

  // Step 1: draft script only (no TTS — fast + cheap preview)
  const draftMut = useMutation({
    mutationFn: () => genFn({
      data: { project_id: projectId, voice, style, tone, speed, script_only: true },
    }),
    onSuccess: (r) => {
      setScript(r.script);
      setBrief(null);
      toast.success(lang === "th" ? "ร่างสคริปต์เสร็จแล้ว — ตรวจสอบก่อนสร้างเสียง" : "Draft ready — review before synthesizing");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  // Step 2: synthesize using the (possibly edited) script
  const synthMut = useMutation({
    mutationFn: () => genFn({
      data: { project_id: projectId, voice, style, tone, speed, script_override: script },
    }),
    onSuccess: (r) => {
      setBrief({ script: r.script, audio_base64: r.audio_base64, mime: r.mime });
      toast.success(lang === "th" ? "สร้าง MP3 แล้ว" : "MP3 ready");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const downloadAll = () => {
    audioUrls.forEach((url, i) => {
      const a = document.createElement("a");
      a.href = url;
      a.download = `notebook-brief-${i + 1}.mp3`;
      a.click();
    });
  };

  const reset = () => { setScript(""); setBrief(null); setEditing(false); };

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Headphones className="h-4 w-4 text-primary" />
          {lang === "th" ? "Audio Brief" : "Audio Brief"}
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <Select value={style} onValueChange={(v) => setStyle(v as "brief" | "podcast")}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="brief">{lang === "th" ? "บรีฟสั้น 1–2 น." : "Brief 1–2 min"}</SelectItem>
              <SelectItem value="podcast">{lang === "th" ? "พอดแคสต์ 2–3 น." : "Podcast 2–3 min"}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
            <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="formal">{lang === "th" ? "ทางการ" : "Formal"}</SelectItem>
              <SelectItem value="semi_formal">{lang === "th" ? "กึ่งทางการ" : "Semi-formal"}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(speed)} onValueChange={(v) => setSpeed(Number(v))}>
            <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SPEEDS.map((s) => (
                <SelectItem key={s.v} value={String(s.v)}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={voice} onValueChange={(v) => setVoice(v as typeof voice)}>
            <SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {AUDIO_BRIEF_VOICES.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {disabled && !script && !brief && (
        <div className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">
          {lang === "th" ? "เพิ่มแหล่งข้อมูลหรือโน้ตอย่างน้อย 1 รายการก่อน" : "Add at least one source or note first."}
        </div>
      )}

      {/* Step 1: draft button */}
      {!script && !brief && !disabled && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              {lang === "th"
                ? "ขั้นตอน: 1) ร่างสคริปต์ก่อน  2) ตรวจ/แก้ไขได้  3) แล้วค่อยสร้างไฟล์ MP3 — ประหยัด credit หากต้องปรับ"
                : "Flow: 1) draft script  2) review/edit  3) then synthesize MP3 — saves credits on retries"}
            </span>
          </div>
          <Button size="sm" onClick={() => draftMut.mutate()} disabled={draftMut.isPending}>
            {draftMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
            {lang === "th" ? "ร่างสคริปต์" : "Draft script"}
          </Button>
        </div>
      )}

      {/* Script preview + synth */}
      {script && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {lang === "th" ? "สคริปต์ตัวอย่าง" : "Script preview"}
              </span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]"
                  onClick={() => setEditing((e) => !e)}>
                  {editing ? (lang === "th" ? "ดูตัวอย่าง" : "Preview") : (lang === "th" ? "แก้ไข" : "Edit")}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]"
                  onClick={() => draftMut.mutate()} disabled={draftMut.isPending}>
                  {draftMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : (lang === "th" ? "ร่างใหม่" : "Re-draft")}
                </Button>
              </div>
            </div>
            {editing ? (
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={8}
                className="w-full rounded border bg-background p-2 text-xs leading-relaxed"
              />
            ) : (
              <div className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded border bg-muted/30 p-3 text-xs leading-relaxed">
                {script}
              </div>
            )}
            <div className="text-[10px] text-muted-foreground">
              {script.length.toLocaleString()} {lang === "th" ? "ตัวอักษร" : "chars"} · ~{Math.ceil(script.length / 1000)} {lang === "th" ? "นาทีโดยประมาณ" : "min est."}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => synthMut.mutate()} disabled={synthMut.isPending || script.trim().length < 20}>
              {synthMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Volume2 className="mr-1 h-3.5 w-3.5" />}
              {lang === "th" ? "สร้าง MP3 จากสคริปต์นี้" : "Synthesize MP3"}
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              {lang === "th" ? "เริ่มใหม่" : "Reset"}
            </Button>
            <span className="text-[10px] text-muted-foreground">
              {voice} · {speed}× · {tone === "formal" ? (lang === "th" ? "ทางการ" : "formal") : (lang === "th" ? "กึ่งทางการ" : "semi-formal")}
            </span>
          </div>
        </div>
      )}

      {synthMut.isPending && (
        <div className="mt-2 text-xs text-muted-foreground">
          {lang === "th" ? "กำลังสังเคราะห์เสียง…" : "Synthesizing audio…"}
        </div>
      )}

      {brief && audioUrls.length > 0 && (
        <div className="mt-3 space-y-2">
          {audioUrls.map((url, i) => (
            <audio key={i} controls src={url} className="w-full" />
          ))}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">
              {lang === "th" ? `เสียง: ${voice} · ${audioUrls.length} ไฟล์` : `Voice: ${voice} · ${audioUrls.length} file(s)`}
            </span>
            <Button size="sm" variant="ghost" onClick={downloadAll}>
              <Download className="mr-1 h-3.5 w-3.5" />MP3
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
