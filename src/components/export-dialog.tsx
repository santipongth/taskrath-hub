import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FileDown, FileText, Download, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { getAgencySettings, type AgencySettings } from "@/lib/admin.functions";
import { exportRunToPdf, exportRunToDocx, type Classification, type Urgency, type SignatureBlock } from "@/lib/export";
import { createSignature, sha256Hex } from "@/lib/signatures.functions";
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

type ProfileSig = { display_name: string | null; signer_position: string | null; signature_data_url: string | null };

export function ExportDialog({ run, templateTitle }: { run: RunLike; templateTitle: string }) {
  const { t, lang } = useI18n();
  const fetchAgency = useServerFn(getAgencySettings);
  const sign = useServerFn(createSignature);
  const { data: agency } = useQuery<AgencySettings>({ queryKey: ["agency"], queryFn: () => fetchAgency() });

  const [open, setOpen] = useState(false);
  const [classification, setClassification] = useState<Classification>("ปกติ");
  const [urgency, setUrgency] = useState<Urgency>("ปกติ");
  const [refNo, setRefNo] = useState("");
  const [recipient, setRecipient] = useState("");
  const [includeLetterhead, setIncludeLetterhead] = useState(true);
  const [signDigital, setSignDigital] = useState(false);
  const [profile, setProfile] = useState<ProfileSig | null>(null);
  const [busy, setBusy] = useState<null | "pdf" | "docx">(null);

  useEffect(() => {
    if (!open) return;
    const inputs = (run.input ?? {}) as Record<string, unknown>;
    setRefNo((prev) => prev || `${run.template_id ?? "อว"}/${run.id.slice(0, 6).toUpperCase()}`);
    setRecipient((prev) => prev || String(inputs.recipient ?? inputs.to ?? ""));
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      supabase.from("profiles")
        .select("display_name, signer_position, signature_data_url")
        .eq("id", uid).maybeSingle()
        .then(({ data: p }) => setProfile((p ?? null) as ProfileSig | null));
    });
  }, [open, run]);

  const canSign = !!profile?.display_name; // signature image is optional but encouraged

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

  async function buildSignature(): Promise<SignatureBlock | null> {
    if (!signDigital) return null;
    if (!canSign || !profile) {
      toast.error("กรุณาตั้งค่าชื่อผู้ลงนามในหน้าตั้งค่าก่อน");
      return null;
    }
    const subject = run.title?.trim() || templateTitle;
    const fullRef = refNo ? `ที่ ${refNo}` : "";
    const hash = await sha256Hex(`${subject}\n${fullRef}\n${run.output ?? ""}`);
    const res = await sign({
      data: {
        runId: run.id,
        signerName: profile.display_name ?? "",
        signerPosition: profile.signer_position ?? "",
        agencyName: agency?.name ?? "",
        documentSubject: subject,
        refNo: fullRef,
        contentHash: hash,
      },
    });
    const verifyUrl = `${window.location.origin}/verify/${res.id}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { errorCorrectionLevel: "M", margin: 1, width: 256 });
    return {
      signerName: profile.display_name ?? "",
      signerPosition: profile.signer_position ?? "",
      signatureImageDataUrl: profile.signature_data_url ?? null,
      qrDataUrl,
      verifyUrl,
      signatureId: res.id,
      contentHash: hash,
      signedAtIso: res.signedAt,
    };
  }

  async function doExport(kind: "pdf" | "docx") {
    setBusy(kind);
    try {
      const lh = await loadLetterhead();
      const signature = await buildSignature();
      if (signDigital && !signature) { setBusy(null); return; }
      const opts = {
        classification, urgency,
        refNo: refNo ? `ที่ ${refNo}` : "",
        recipient,
        includeLetterhead,
        letterheadBytes: lh?.bytes ?? null,
        letterheadMime: lh?.mime,
        signature,
      };
      if (kind === "pdf") await exportRunToPdf(run, templateTitle, agency ?? null, opts);
      else await exportRunToDocx(run, templateTitle, agency ?? null, opts);
      toast.success(`${kind.toUpperCase()}${signature ? " · ลงนามแล้ว" : ""}`);
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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

        <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              ลงลายเซ็นดิจิทัล + QR ตรวจสอบ
            </Label>
            <Switch checked={signDigital} onCheckedChange={setSignDigital} disabled={!canSign} />
          </div>
          {!canSign ? (
            <p className="mt-1 text-[11px] text-muted-foreground">กรุณาตั้งชื่อผู้ลงนามและอัปโหลดภาพลายเซ็นในหน้า “ตั้งค่า”</p>
          ) : signDigital ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              ผู้ลงนาม: <strong>{profile?.display_name}</strong>
              {profile?.signer_position ? ` · ${profile.signer_position}` : ""} —
              จะคำนวณ SHA-256 ของเอกสารและสร้าง QR ตรวจสอบที่ /verify/&lt;id&gt;
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-muted-foreground">ไม่ลงนาม (ใช้ลายเซ็นของหน่วยงานในส่วนท้าย)</p>
          )}
        </div>

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
