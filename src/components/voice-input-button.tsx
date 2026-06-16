import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Minimal types for the Web Speech API (not in lib.dom.d.ts cross-browser)
type SRResult = { 0: { transcript: string }; isFinal: boolean };
type SREvent = { resultIndex: number; results: ArrayLike<SRResult> };
type SRError = { error: string };
type SRInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRError) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SRInstance) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SRInstance;
    webkitSpeechRecognition?: new () => SRInstance;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isVoiceInputSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export function VoiceInputButton({
  onTranscript,
  lang = "th-TH",
  className,
  size = "sm",
}: {
  onTranscript: (text: string, isFinal: boolean) => void;
  lang?: string;
  className?: string;
  size?: "sm" | "icon";
}) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<SRInstance | null>(null);
  const supported = isVoiceInputSupported();

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* ignore */ } }, []);

  if (!supported) return null;

  const start = () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    try {
      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let finalText = "";
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        if (finalText) onTranscript(finalText, true);
        else if (interim) onTranscript(interim, false);
      };
      rec.onerror = (ev) => {
        if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
          toast.error("ไม่ได้รับอนุญาตใช้ไมโครโฟน");
        } else if (ev.error !== "aborted" && ev.error !== "no-speech") {
          toast.error(`ข้อผิดพลาดเสียง: ${ev.error}`);
        }
        setListening(false);
      };
      rec.onend = () => setListening(false);
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เริ่มรับเสียงไม่ได้");
    }
  };

  const stop = () => { try { recRef.current?.stop(); } catch { /* ignore */ } setListening(false); };

  return size === "icon" ? (
    <Button
      type="button"
      variant={listening ? "default" : "ghost"}
      size="icon"
      className={className}
      onClick={listening ? stop : start}
      aria-label={listening ? "หยุดบันทึกเสียง" : "พูดเพื่อพิมพ์"}
      title={listening ? "หยุดบันทึกเสียง" : "พูดเพื่อพิมพ์ (ภาษาไทย)"}
    >
      {listening ? <MicOff className="h-4 w-4 animate-pulse text-destructive" /> : <Mic className="h-4 w-4" />}
    </Button>
  ) : (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`h-6 px-2 text-[11px] ${className ?? ""}`}
      onClick={listening ? stop : start}
    >
      {listening ? (
        <><MicOff className="mr-1 h-3 w-3 animate-pulse text-destructive" />หยุด</>
      ) : (
        <><Mic className="mr-1 h-3 w-3" />พูด</>
      )}
    </Button>
  );
}
