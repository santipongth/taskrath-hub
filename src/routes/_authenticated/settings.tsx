import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, X, PenLine, Quote } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { UserMemoryCard } from "@/components/user-memory-card";
import { UserSkillsCard } from "@/components/user-skills-card";
import { useCitationStyle } from "@/lib/citation-prefs";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "ตั้งค่า · RathCoWork" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { userId, email } = Route.useRouteContext();
  const navigate = useNavigate();
  const [citationStyle, setCitStyle] = useCitationStyle();
  const [displayName, setDisplayName] = useState("");
  const [department, setDepartment] = useState("");
  const [signerPosition, setSignerPosition] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("profiles")
      .select("display_name, department, signer_position, signature_data_url")
      .eq("id", userId).maybeSingle().then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name ?? "");
          setDepartment(data.department ?? "");
          setSignerPosition(data.signer_position ?? "");
          setSignatureDataUrl(data.signature_data_url ?? "");
        }
      });
  }, [userId]);

  const onPickSignature = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("กรุณาเลือกไฟล์รูปภาพ"); return; }
    if (file.size > 500 * 1024) { toast.error("ไฟล์ต้องไม่เกิน 500KB"); return; }
    const reader = new FileReader();
    reader.onload = () => setSignatureDataUrl(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      display_name: displayName,
      department,
      language_pref: lang,
      signer_position: signerPosition,
      signature_data_url: signatureDataUrl || null,
    }).eq("id", userId);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success(t("save"));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-xl font-semibold text-foreground">{t("settingsTitle")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{email}</p>

      <div className="mt-6 space-y-4 rounded-lg border border-border bg-card p-5">
        <div className="space-y-1.5">
          <Label htmlFor="dn" className="text-xs">{t("displayName")}</Label>
          <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dept" className="text-xs">{t("settingsDepartment")}</Label>
          <Input id="dept" value={department} onChange={(e) => setDepartment(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("settingsLanguage")}</Label>
          <div className="flex gap-2">
            <Button type="button" variant={lang === "th" ? "default" : "outline"} size="sm" onClick={() => setLang("th")}>ไทย</Button>
            <Button type="button" variant={lang === "en" ? "default" : "outline"} size="sm" onClick={() => setLang("en")}>English</Button>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3 rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <PenLine className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">ลายเซ็นดิจิทัล</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          ใช้สำหรับลงนามเอกสารพร้อม QR ตรวจสอบ ตาม พ.ร.บ.ว่าด้วยธุรกรรมทางอิเล็กทรอนิกส์ พ.ศ. 2544
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="pos" className="text-xs">ตำแหน่งของผู้ลงนาม</Label>
          <Input id="pos" value={signerPosition} onChange={(e) => setSignerPosition(e.target.value)} placeholder="เช่น ผู้อำนวยการกอง…" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">ภาพลายเซ็น (PNG/JPG พื้นหลังโปร่งใส แนะนำ, ≤ 500KB)</Label>
          {signatureDataUrl ? (
            <div className="flex items-center gap-3 rounded-md border border-dashed border-border bg-muted/40 p-3">
              <img src={signatureDataUrl} alt="signature" className="h-16 w-40 object-contain" />
              <Button variant="ghost" size="sm" onClick={() => setSignatureDataUrl("")}>
                <X className="mr-1 h-3.5 w-3.5" /> ลบ
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1.5 h-3.5 w-3.5" /> อัปโหลดภาพลายเซ็น
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onPickSignature(e.target.files[0])}
          />
        </div>
      </div>

      <div className="mt-4 space-y-3 rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Quote className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">
            {lang === "th" ? "การแสดงอ้างอิงใน Notebook" : "Notebook citation display"}
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          {lang === "th"
            ? "เลือกว่าจะให้คำตอบของ AI แสดง [อ้างอิง] เป็นตัวเลขในเนื้อหาอย่างเดียว หรือเพิ่มแถบ ‘แหล่งที่อ้างอิง’ ด้านล่างคำตอบด้วย"
            : "Choose whether AI answers show only inline [citation] markers or also include a ‘Cited sources’ panel below the answer."}
        </p>
        <div className="flex items-start justify-between gap-4 rounded-md border bg-background p-3">
          <div className="min-w-0">
            <div className="text-xs font-medium">
              {lang === "th" ? "แสดงแถบ ‘แหล่งที่อ้างอิง’" : "Show ‘Cited sources’ panel"}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {citationStyle === "with_panel"
                ? lang === "th"
                  ? "เปิด — เห็น [1][2] ในข้อความ + แถบรายชื่อแหล่งด้านล่าง"
                  : "On — inline [1][2] plus a list of cited sources below."
                : lang === "th"
                  ? "ปิด — เห็นเฉพาะ [1][2] inline แบบกะทัดรัด"
                  : "Off — compact inline [1][2] only."}
            </div>
          </div>
          <Switch
            checked={citationStyle === "with_panel"}
            onCheckedChange={(b) => setCitStyle(b ? "with_panel" : "inline_only")}
          />
        </div>
      </div>

      <div className="mt-4">
        <UserMemoryCard lang={lang} />
      </div>

      <div className="mt-4">
        <UserSkillsCard />
      </div>

      <div className="mt-4 flex justify-between">
        <Button variant="ghost" onClick={signOut}>{t("signOut")}</Button>
        <Button onClick={save} disabled={saving}>{saving ? t("running") : t("save")}</Button>
      </div>
    </div>
  );
}
