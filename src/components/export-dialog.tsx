import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FileDown, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { getAgencySettings, type AgencySettings } from "@/lib/admin.functions";
import { exportRunToPdf, exportRunToDocx, type Classification, type Urgency } from "@/lib/export";
import { supabase } from "@/integrations/supabase/client";

type RunLike = {
  id: string;
  title?: string | null;
  output?: string | null;
  created_at: string;
  input?: unknown;
  template_id?: string | null;
};

const CLASSIFICATIONS: Classification[] = ["ปกติ", "ลับ", "ลับมาก", "ลับที่สุด"];
const URGENCIES: Urgency[] = ["ปกติ", "ด่วน", "ด่วนมาก", "ด่วนที่สุด"];

export function ExportDialog({
  run,
  templateTitle,
}: {
  run: RunLike;
  templateTitle: string;
}) {
  const { t, lang } = useI18n();
  const fetchAgency = useServerFn(getAgencySettings);
  const { data: agency } = useQuery<AgencySettings>({ queryKey: ["agency"], queryFn: () => fetchAgency() });

  const [open, setOpen] = useState(false);
  const [classification, setClassification] = useState<Classification>("ปกติ");
  const [urgency, setUrgency] = useState<Urgency>("ปกติ");
  const [refNo, setRefNo] = useState("");
  const [recipient, setRecipient] = useState("");
  const [includeLetterhead, setIncludeLetterhead] = useState(true);
  const [busy, setBusy] = useState<null | "pdf" | "docx">(null);

  useEffect(() => {
    if (!open) return;
    const inputs = (run.input ?? {}) as Record<string, unknown>;
    setRefNo((prev) => prev || `${run.template_id ?? "อว"}/${run.id.slice(0, 6).toUpperCase()}`);
    setRecipient((prev) => prev || String(inputs.recipient ?? inputs.to ?? ""));
  }, [open, run]);

  async function loadLetterhead(): Promise<{ bytes: Uint8Array; mime: "png" | "jpg" } | null> {
    if (!includeLetterhead || !agency?.letterheadPath) return null;
    const { data, error } = await supabase.storage.from("agency-assets").download(agency.letterheadPath);
    if (error || !data) {
      toast.error(t("export_letterheadMissing"));
      return null;
    }
    const buf = new Uint8Array(await data.arrayBuffer());
    const lower = agency.letterheadPath.toLowerCase();
    const mime: "png" | "jpg" = lower.endsWith(".jpg") || lower.endsWith(".jpeg") ? "jpg" : "png";
    return { bytes: buf, mime };
  }

  async function doExport(kind: "pdf" | "docx") {
    setBusy(kind);
    try {
      const lh = await loadLetterhead();
      const opts = {
        classification,
        urgency,
        refNo: refNo ? `ที่ ${refNo}` : "",
        recipient,
        includeLetterhead,
        letterheadBytes: lh?.bytes ?? null,
        letterheadMime: lh?.mime,
      };
      if (kind === "pdf") {
        await exportRunToPdf(run, templateTitle, agency ?? null, opts);
      } else {
        await exportRunToDocx(run, templateTitle, agency ?? null, opts);
      }
      toast.success(kind.toUpperCase());
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {t("export_button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("export_title")}</DialogTitle>
          <DialogDescription>
            {lang === "th"
              ? "ตั้งค่าหัวกระดาษและส่งออกตามระเบียบงานสารบรรณ"
              : "Configure letterhead and export per official format"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("export_classification")}</Label>
            <Select value={classification} onValueChange={(v) => setClassification(v as Classification)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CLASSIFICATIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("export_urgency")}</Label>
            <Select value={urgency} onValueChange={(v) => setUrgency(v as Urgency)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {URGENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t("export_refNo")}</Label>
          <Input value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="อว/123456" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t("export_recipient")}</Label>
          <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="ผู้อำนวยการ…" />
        </div>

        <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
          <Label className="text-xs">{t("export_includeLetterhead")}</Label>
          <Switch checked={includeLetterhead} onCheckedChange={setIncludeLetterhead} disabled={!agency?.letterheadPath} />
        </div>
        {!agency?.letterheadPath && (
          <p className="text-[11px] text-muted-foreground">{t("export_letterheadMissing")}</p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => doExport("docx")} disabled={busy !== null}>
            <FileText className="mr-1.5 h-4 w-4" />
            {busy === "docx" ? "…" : t("export_downloadDocx")}
          </Button>
          <Button onClick={() => doExport("pdf")} disabled={busy !== null}>
            <FileDown className="mr-1.5 h-4 w-4" />
            {busy === "pdf" ? "…" : t("export_downloadPdf")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
