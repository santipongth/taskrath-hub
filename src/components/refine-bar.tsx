import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { refineRun, revertRun } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import { Loader2, Sparkles, History, Undo2 } from "lucide-react";
import { toast } from "sonner";

type Revision = {
  output: string;
  instruction: string;
  preset?: string;
  at: string;
};

type Props = {
  runId: string;
  revisions: Revision[];
  onUpdated: (output: string, revisions: Revision[]) => void;
};

const PRESETS: Array<{
  key: "formal" | "shorter" | "longer" | "friendly" | "proofread";
  th: string;
  en: string;
}> = [
  { key: "formal", th: "ทางการขึ้น", en: "More formal" },
  { key: "shorter", th: "สั้นลง", en: "Shorter" },
  { key: "longer", th: "ละเอียดขึ้น", en: "More detail" },
  { key: "friendly", th: "เป็นมิตรขึ้น", en: "Friendlier" },
  { key: "proofread", th: "แก้คำผิด", en: "Proofread" },
];

export function RefineBar({ runId, revisions, onUpdated }: Props) {
  const { lang } = useI18n();
  const refine = useServerFn(refineRun);
  const revert = useServerFn(revertRun);
  const [loading, setLoading] = useState<string | null>(null);
  const [custom, setCustom] = useState("");

  const apply = async (
    args: { preset?: "formal" | "shorter" | "longer" | "friendly" | "proofread"; instruction?: string },
    key: string,
  ) => {
    setLoading(key);
    try {
      const res = await refine({ data: { runId, ...args } });
      onUpdated(res.output, res.revisions as Revision[]);
      toast.success(lang === "th" ? "ปรับผลลัพธ์แล้ว" : "Refined");
      if (args.instruction) setCustom("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(null);
    }
  };

  const doRevert = async (index: number) => {
    setLoading(`rev-${index}`);
    try {
      const res = await revert({ data: { runId, index } });
      onUpdated(res.output, revisions);
      toast.success(lang === "th" ? "กู้คืนเวอร์ชันแล้ว" : "Reverted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(null);
    }
  };

  const undoLast = () => {
    if (revisions.length === 0) return;
    void doRevert(revisions.length - 1);
  };

  return (
    <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {lang === "th" ? "ปรับผลลัพธ์" : "Refine"}
        </div>
        <div className="flex items-center gap-1">
          {revisions.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                onClick={undoLast}
                disabled={loading !== null}
              >
                <Undo2 className="mr-1 h-3 w-3" />
                {lang === "th" ? "ย้อนกลับ" : "Undo"}
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-[11px]">
                    <History className="mr-1 h-3 w-3" />
                    {lang === "th" ? "เวอร์ชัน" : "Versions"}
                    <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                      {revisions.length}
                    </Badge>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="max-h-80 overflow-auto">
                    {[...revisions].reverse().map((rev, i) => {
                      const realIndex = revisions.length - 1 - i;
                      return (
                        <div
                          key={`${rev.at}-${realIndex}`}
                          className="flex items-start justify-between gap-2 border-b border-border px-3 py-2 last:border-0"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium text-foreground">
                              {rev.instruction || (lang === "th" ? "(ไม่ระบุ)" : "(no label)")}
                            </div>
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              {new Date(rev.at).toLocaleString(lang === "th" ? "th-TH" : "en-US")}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px]"
                            disabled={loading !== null}
                            onClick={() => doRevert(realIndex)}
                          >
                            {loading === `rev-${realIndex}` ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              lang === "th" ? "กู้คืน" : "Restore"
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            disabled={loading !== null}
            onClick={() => apply({ preset: p.key }, p.key)}
          >
            {loading === p.key && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            {lang === "th" ? p.th : p.en}
          </Button>
        ))}
      </div>

      <form
        className="mt-2.5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (custom.trim()) apply({ instruction: custom.trim() }, "custom");
        }}
      >
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder={lang === "th" ? "พิมพ์คำสั่งปรับเอง เช่น เพิ่มหัวข้อสรุปท้ายเอกสาร" : "Custom instruction..."}
          className="h-8 text-xs"
          disabled={loading !== null}
        />
        <Button type="submit" size="sm" className="h-8" disabled={loading !== null || !custom.trim()}>
          {loading === "custom" ? <Loader2 className="h-3 w-3 animate-spin" /> : (lang === "th" ? "ปรับ" : "Apply")}
        </Button>
      </form>
    </div>
  );
}
