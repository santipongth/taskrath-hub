import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { getAgencySettings, updateAgencySettings, type AgencySettings } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Save, Upload, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "ตั้งค่าหน่วยงาน · TaskRath Admin" }] }),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const { lang } = useI18n();
  const L = (th: string, en: string) => (lang === "th" ? th : en);
  const qc = useQueryClient();
  const fetchAgency = useServerFn(getAgencySettings);
  const saveAgency = useServerFn(updateAgencySettings);

  const { data, isLoading } = useQuery({ queryKey: ["agency"], queryFn: () => fetchAgency() });
  const [form, setForm] = useState<AgencySettings | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { if (data && !form) setForm(data); }, [data, form]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setPreviewUrl(null);
      if (!form?.letterheadPath) return;
      const { data: blob, error } = await supabase.storage.from("agency-assets").download(form.letterheadPath);
      if (cancelled || error || !blob) return;
      setPreviewUrl(URL.createObjectURL(blob));
    }
    load();
    return () => { cancelled = true; };
  }, [form?.letterheadPath]);

  const mut = useMutation({
    mutationFn: (v: AgencySettings) => saveAgency({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agency"] });
      toast.success(L("บันทึกแล้ว", "Saved"));
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  async function uploadLetterhead(file: File) {
    if (!form) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("≤ 2MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() === "jpg" || file.name.toLowerCase().endsWith(".jpeg") ? "jpg" : "png";
      const path = `letterhead-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("agency-assets").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const next = { ...form, letterheadPath: path };
      setForm(next);
      await saveAgency({ data: next });
      qc.invalidateQueries({ queryKey: ["agency"] });
      toast.success(L("อัปโหลดแล้ว", "Uploaded"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload error");
    } finally {
      setUploading(false);
    }
  }

  if (isLoading || !form) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 px-6 py-8">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  function field<K extends keyof AgencySettings>(key: K, value: string) {
    setForm((f) => f ? { ...f, [key]: value } : f);
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Building2 className="h-5 w-5 text-primary" />
          {L("ตั้งค่าหน่วยงาน", "Agency settings")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {L("ข้อมูลนี้จะใช้บนหัวกระดาษหนังสือราชการที่ Export เป็น DOCX/PDF", "Used on the header of exported government letters")}
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-card p-5">
        <Row label={L("ชื่อหน่วยงาน", "Agency name")}>
          <Input value={form.name} onChange={(e) => field("name", e.target.value)} />
        </Row>
        <Row label={L("ส่วน/กอง/ฝ่าย", "Sub-unit")}>
          <Input value={form.subUnit} onChange={(e) => field("subUnit", e.target.value)} placeholder={L("เช่น กองนโยบายและแผน", "e.g., Planning Division")} />
        </Row>
        <Row label={L("ที่อยู่", "Address")}>
          <Textarea rows={2} value={form.address} onChange={(e) => field("address", e.target.value)} />
        </Row>
        <Row label={L("โทรศัพท์", "Phone")}>
          <Input value={form.phone} onChange={(e) => field("phone", e.target.value)} />
        </Row>
        <Row label={L("อีเมล", "Email")}>
          <Input value={form.email} onChange={(e) => field("email", e.target.value)} />
        </Row>

        <div className="border-t border-border pt-4">
          <h2 className="mb-3 text-sm font-semibold">{L("ตราครุฑ / หัวกระดาษ", "Letterhead / Garuda emblem")}</h2>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-md border border-border bg-muted">
              {previewUrl ? (
                <img src={previewUrl} alt="letterhead" className="max-h-full max-w-full object-contain" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLetterhead(f); e.target.value = ""; }}
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Upload className="mr-1.5 h-4 w-4" />{uploading ? "…" : L("อัปโหลด PNG/JPG", "Upload PNG/JPG")}
                </Button>
                {form.letterheadPath && (
                  <Button variant="ghost" size="sm" onClick={() => { setForm({ ...form, letterheadPath: "" }); }}>
                    <X className="mr-1.5 h-3.5 w-3.5" />{L("ลบ", "Remove")}
                  </Button>
                )}
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">{L("แนะนำตราครุฑพื้นโปร่งใส (PNG) ขนาดสูงสุด 2MB", "PNG with transparent background recommended, max 2MB")}</p>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <h2 className="mb-3 text-sm font-semibold">{L("ผู้ลงนาม (ค่าเริ่มต้น)", "Default signer")}</h2>
          <div className="space-y-4">
            <Row label={L("ชื่อ-นามสกุล", "Name")}>
              <Input value={form.signerName} onChange={(e) => field("signerName", e.target.value)} />
            </Row>
            <Row label={L("ตำแหน่ง", "Position")}>
              <Input value={form.signerPosition} onChange={(e) => field("signerPosition", e.target.value)} />
            </Row>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={() => mut.mutate(form)} disabled={mut.isPending}>
            <Save className="mr-1.5 h-4 w-4" />
            {mut.isPending ? L("กำลังบันทึก…", "Saving…") : L("บันทึก", "Save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
