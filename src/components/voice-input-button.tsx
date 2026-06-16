import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

// Minimal typings for the Web Speech API (not in lib.dom by default)
type SRResult = { 0: { transcript: string }; isFinal: boolean };
type SREvent = { resultIndex: number; results: ArrayLike<SRResult> };
type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SRCtor = new () => SR;

function getSR(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function VoiceInputButton({
  onTranscript,
  size = "sm",
  className,
}: {
  /** Called with the (possibly partial) recognized text, replacing any previous interim chunk. */
  onTranscript: (chunk: string, isFinal: boolean) => void;
  size?: "sm" | "default" | "icon";
  className?: string;
}) {
  const { lang } = useI18n();
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SR | null>(null);

  useEffect(() => {
    setSupported(!!getSR());
    return () => { recRef.current?.abort(); };
  }, []);

  const start = () => {
    const Ctor = getSR();
    if (!Ctor) {
      toast.error(lang === "th" ? "เบราว์เซอร์นี้ไม่รองรับการพูด" : "Voice input not supported");
      return;
    }
    const rec = new Ctor();
    rec.lang = lang === "th" ? "th-TH" : "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let finalChunk = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalChunk += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (finalChunk) onTranscript(finalChunk, true);
      else if (interim) onTranscript(interim, false);
    };
    rec.onerror = (ev) => {
      if (ev.error !== "no-speech" && ev.error !== "aborted") {
        toast.error(`${lang === "th" ? "ผิดพลาด" : "Error"}: ${ev.error}`);
      }
    };
    rec.onend = () => setListening(false);
    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mic error");
    }
  };

  const stop = () => recRef.current?.stop();

  if (!supported) return null;

  return (
    <Button
      type="button"
      size={size}
      variant={listening ? "default" : "outline"}
      onClick={listening ? stop : start}
      className={className}
      aria-pressed={listening}
      title={listening ? (lang === "th" ? "หยุดบันทึก" : "Stop") : (lang === "th" ? "พูดเพื่อกรอก" : "Speak to dictate")}
    >
      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      <span className="ml-1.5 hidden sm:inline">
        {listening ? (lang === "th" ? "กำลังฟัง…" : "Listening…") : (lang === "th" ? "พูด" : "Voice")}
      </span>
    </Button>
  );
}
