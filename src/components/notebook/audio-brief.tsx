import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Headphones, Loader2, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { generateAudioBrief, AUDIO_BRIEF_VOICES } from "@/lib/audio-brief.functions";

type Brief = { script: string; audio_base64: string[]; mime: string };

export function AudioBrief({ projectId, lang, disabled }: { projectId: string; lang: string; disabled: boolean }) {
  const [voice, setVoice] = useState<(typeof AUDIO_BRIEF_VOICES)[number]>("alloy");
  const [style, setStyle] = useState<"brief" | "podcast">("brief");
  const [brief, setBrief] = useState<Brief | null>(null);
  const genFn = useServerFn(generateAudioBrief);

  const audioUrls = useMemo(() => {
    if (!brief) return [];
    return brief.audio_base64.map((b64) => `data:${brief.mime};base64,${b64}`);
  }, [brief]);

  const genMut = useMutation({
    mutationFn: () => genFn({ data: { project_id: projectId, voice, style } }),
    onSuccess: (r) => {
      setBrief({ script: r.script, audio_base64: r.audio_base64, mime: r.mime });
      toast.success(lang === "th" ? "สร้าง Audio Brief แล้ว" : "Audio brief ready");
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

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Headphones className="h-4 w-4 text-primary" />
          {lang === "th" ? "Audio Brief" : "Audio Brief"}
        </h2>
        <div className="flex items-center gap-2">
          <Select value={style} onValueChange={(v) => setStyle(v as "brief" | "podcast")}>
            <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="brief">{lang === "th" ? "บรีฟสั้น 1–2 นาที" : "Brief 1–2 min"}</SelectItem>
              <SelectItem value="podcast">{lang === "th" ? "พอดแคสต์ 2–3 นาที" : "Podcast 2–3 min"}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={voice} onValueChange={(v) => setVoice(v as typeof voice)}>
            <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {AUDIO_BRIEF_VOICES.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => genMut.mutate()} disabled={genMut.isPending || disabled}>
            {genMut.isPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1 h-3.5 w-3.5" />
            )}
            {lang === "th" ? "สร้าง" : "Generate"}
          </Button>
        </div>
      </div>

      {disabled && !brief && (
        <div className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">
          {lang === "th" ? "เพิ่มแหล่งข้อมูลหรือโน้ตอย่างน้อย 1 รายการก่อน" : "Add at least one source or note first."}
        </div>
      )}

      {genMut.isPending && (
        <div className="text-xs text-muted-foreground">
          {lang === "th" ? "กำลังเขียนสคริปต์และสังเคราะห์เสียง…" : "Drafting script and synthesizing audio…"}
        </div>
      )}

      {brief && (
        <div className="space-y-3">
          <div className="space-y-2">
            {audioUrls.map((url, i) => (
              <audio key={i} controls src={url} className="w-full" />
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">
              {lang === "th" ? `เสียง: ${voice} · ${audioUrls.length} ไฟล์` : `Voice: ${voice} · ${audioUrls.length} file(s)`}
            </span>
            <Button size="sm" variant="ghost" onClick={downloadAll}>
              <Download className="mr-1 h-3.5 w-3.5" />MP3
            </Button>
          </div>
          <details className="rounded border bg-background p-3 text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              {lang === "th" ? "ดูสคริปต์" : "View script"}
            </summary>
            <div className="mt-2 whitespace-pre-wrap leading-relaxed">{brief.script}</div>
          </details>
        </div>
      )}
    </section>
  );
}
