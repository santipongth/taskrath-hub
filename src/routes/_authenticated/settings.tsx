import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "ตั้งค่า · TaskRath" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { userId, email } = Route.useRouteContext();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [department, setDepartment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("profiles").select("display_name, department").eq("id", userId).maybeSingle().then(({ data }) => {
      if (data) {
        setDisplayName(data.display_name ?? "");
        setDepartment(data.department ?? "");
      }
    });
  }, [userId]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName, department, language_pref: lang }).eq("id", userId);
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
        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={signOut}>{t("signOut")}</Button>
          <Button onClick={save} disabled={saving}>{saving ? t("running") : t("save")}</Button>
        </div>
      </div>
    </div>
  );
}
