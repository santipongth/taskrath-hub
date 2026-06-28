import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getSharedSkill,
  upsertSharedSkill,
  deleteSharedSkill,
  setSharedSkillActive,
} from "@/lib/shared-skills.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Save, Trash2, Eye, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/skills/manage/$skillId")({
  head: () => ({ meta: [{ title: "รายละเอียด Skill · RathCoWork" }] }),
  component: SkillDetailsPage,
});

type Form = {
  name: string;
  icon: string;
  category: string;
  description: string;
  example_output: string;
  role_prompt: string;
  default_model_selector: string;
  sort_order: number;
  is_active: boolean;
};

function SkillDetailsPage() {
  const { skillId } = Route.useParams();
  const { lang } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchOne = useServerFn(getSharedSkill);
  const upsert = useServerFn(upsertSharedSkill);
  const del = useServerFn(deleteSharedSkill);
  const toggleActive = useServerFn(setSharedSkillActive);

  const { data, isLoading } = useQuery({
    queryKey: ["shared-skill", skillId],
    queryFn: () => fetchOne({ data: { id: skillId } }),
  });

  const skill = data?.skill ?? null;
  const canManage = data?.canManage ?? false;

  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggleOpen, setToggleOpen] = useState(false);

  useEffect(() => {
    if (skill) {
      setForm({
        name: skill.name,
        icon: skill.icon ?? "",
        category: skill.category ?? "",
        description: skill.description ?? "",
        example_output: skill.example_output ?? "",
        role_prompt: skill.role_prompt,
        default_model_selector: skill.default_model_selector ?? "",
        sort_order: skill.sort_order,
        is_active: skill.is_active,
      });
    }
  }, [skill]);

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">{lang === "th" ? "กำลังโหลด…" : "Loading…"}</div>;
  }

  if (!canManage) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center space-y-4">
        <h1 className="text-xl font-semibold">{lang === "th" ? "ไม่มีสิทธิ์" : "Not authorized"}</h1>
        <p className="text-sm text-muted-foreground">
          {lang === "th" ? "เฉพาะผู้ดูแลระบบเท่านั้นที่ดูรายละเอียด Skill ได้" : "Only admins can view skill details."}
        </p>
        <Button asChild variant="outline"><Link to="/skills"><ArrowLeft className="h-4 w-4 mr-1" />{lang === "th" ? "กลับ" : "Back"}</Link></Button>
      </div>
    );
  }

  if (!skill || !form) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center space-y-4">
        <h1 className="text-xl font-semibold">{lang === "th" ? "ไม่พบ Skill" : "Skill not found"}</h1>
        <Button asChild variant="outline"><Link to="/skills/manage"><ArrowLeft className="h-4 w-4 mr-1" />{lang === "th" ? "กลับรายการ" : "Back to list"}</Link></Button>
      </div>
    );
  }

  const save = async () => {
    if (!form.name.trim() || !form.role_prompt.trim()) {
      toast.error(lang === "th" ? "กรอกชื่อและบทบาท" : "Name and role prompt required");
      return;
    }
    setSaving(true);
    try {
      await upsert({
        data: {
          id: skill.id,
          name: form.name,
          icon: form.icon || null,
          category: form.category || null,
          description: form.description || null,
          example_output: form.example_output || null,
          role_prompt: form.role_prompt,
          default_model_selector: form.default_model_selector || null,
          sort_order: form.sort_order,
          is_active: form.is_active,
        },
      });
      qc.invalidateQueries({ queryKey: ["shared-skill", skillId] });
      qc.invalidateQueries({ queryKey: ["shared-skills-admin"] });
      qc.invalidateQueries({ queryKey: ["shared-skills"] });
      qc.invalidateQueries({ queryKey: ["available-skills"] });
      toast.success(lang === "th" ? "บันทึกแล้ว" : "Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await del({ data: { id: skill.id } });
      qc.invalidateQueries({ queryKey: ["shared-skills-admin"] });
      qc.invalidateQueries({ queryKey: ["shared-skills"] });
      qc.invalidateQueries({ queryKey: ["available-skills"] });
      toast.success(lang === "th" ? "ลบแล้ว" : "Deleted");
      navigate({ to: "/skills/manage" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const doToggle = async () => {
    const next = !form.is_active;
    try {
      await toggleActive({ data: { id: skill.id, is_active: next } });
      setForm({ ...form, is_active: next });
      qc.invalidateQueries({ queryKey: ["shared-skill", skillId] });
      qc.invalidateQueries({ queryKey: ["shared-skills-admin"] });
      qc.invalidateQueries({ queryKey: ["shared-skills"] });
      qc.invalidateQueries({ queryKey: ["available-skills"] });
      toast.success(next ? (lang === "th" ? "เปิดใช้งานแล้ว" : "Activated") : (lang === "th" ? "ปิดใช้งานแล้ว" : "Deactivated"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setToggleOpen(false);
    }
  };

  const updatedLabel = (() => {
    const d = new Date(skill.updated_at);
    return isNaN(d.getTime()) ? "" : d.toLocaleString(lang === "th" ? "th-TH" : "en-US", { dateStyle: "medium", timeStyle: "short" });
  })();

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      <header>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/skills/manage"><ArrowLeft className="h-3.5 w-3.5 mr-1" />{lang === "th" ? "กลับรายการ" : "Back to list"}</Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2 flex-wrap">
              {skill.name}
              {form.is_active ? (
                <Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0">
                  {lang === "th" ? "เปิดใช้งาน" : "active"}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">{lang === "th" ? "ปิดใช้" : "inactive"}</Badge>
              )}
            </h1>
            {updatedLabel && (
              <p className="text-xs text-muted-foreground mt-1">
                {lang === "th" ? "อัปเดตล่าสุด" : "Updated"}: {updatedLabel}
              </p>
            )}
          </div>
          <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1.5" />{lang === "th" ? "บันทึก" : "Save"}</Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">{lang === "th" ? "ข้อมูลทั่วไป" : "General"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">{lang === "th" ? "ชื่อ Skill" : "Name"} *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">{lang === "th" ? "หมวด" : "Category"}</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} maxLength={60} />
              </div>
              <div>
                <Label className="text-xs">{lang === "th" ? "ลำดับ" : "Sort order"}</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">{lang === "th" ? "คำอธิบายสั้น" : "Description"}</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} />
            </div>
            <div>
              <Label className="text-xs">{lang === "th" ? "บทบาท / System prompt" : "Role prompt"} *</Label>
              <Textarea rows={8} value={form.role_prompt} onChange={(e) => setForm({ ...form, role_prompt: e.target.value })} maxLength={6000} />
            </div>
            <div>
              <Label className="text-xs">{lang === "th" ? "ตัวอย่างผลลัพธ์ (ทางเลือก)" : "Example output (optional)"}</Label>
              <Textarea rows={4} value={form.example_output} onChange={(e) => setForm({ ...form, example_output: e.target.value })} maxLength={4000} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">{lang === "th" ? "ไอคอน (ทางเลือก)" : "Icon (optional)"}</Label>
                <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} maxLength={40} placeholder="✨" />
              </div>
              <div>
                <Label className="text-xs">{lang === "th" ? "โมเดลที่แนะนำ (ทางเลือก)" : "Default model (optional)"}</Label>
                <Input value={form.default_model_selector} onChange={(e) => setForm({ ...form, default_model_selector: e.target.value })} maxLength={120} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" />{lang === "th" ? "การมองเห็น" : "Visibility"}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-md border border-border p-2">
                <div>
                  <Label className="text-xs">{lang === "th" ? "สถานะ" : "Status"}</Label>
                  <p className="text-[11px] text-muted-foreground">
                    {form.is_active
                      ? (lang === "th" ? "เปิดให้ใช้งาน" : "Available to users")
                      : (lang === "th" ? "ซ่อนจากผู้ใช้" : "Hidden from users")}
                  </p>
                </div>
                <AlertDialog open={toggleOpen} onOpenChange={setToggleOpen}>
                  <AlertDialogTrigger asChild>
                    <Switch checked={form.is_active} onClick={(e) => { e.preventDefault(); setToggleOpen(true); }} />
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {form.is_active
                          ? (lang === "th" ? "ปิดใช้งาน Skill นี้?" : "Deactivate this skill?")
                          : (lang === "th" ? "เปิดใช้งาน Skill นี้?" : "Activate this skill?")}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {form.is_active
                          ? (lang === "th" ? "ผู้ใช้ทั่วไปจะมองไม่เห็นจนกว่าจะเปิดอีกครั้ง" : "Members won't see it until reactivated.")
                          : (lang === "th" ? "ผู้ใช้ทุกคนจะเรียกใช้งานได้ทันที" : "All users will be able to use it immediately.")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{lang === "th" ? "ยกเลิก" : "Cancel"}</AlertDialogCancel>
                      <AlertDialogAction onClick={doToggle}>{lang === "th" ? "ยืนยัน" : "Confirm"}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div>
                <p className="text-xs font-medium mb-1.5">{lang === "th" ? "ผู้ที่เรียกใช้ได้" : "Who can use it"}</p>
                {form.is_active ? (
                  <div className="rounded-md border border-border p-2 text-xs text-muted-foreground">
                    {lang === "th"
                      ? "ผู้ใช้ที่ลงชื่อเข้าใช้ทั้งหมด — เห็นในเมนู Skills, Run และ Research"
                      : "All signed-in users — visible in Skills, Run, and Research."}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground">
                    {lang === "th" ? "ไม่มี — Skill ถูกซ่อน" : "Nobody — skill is hidden."}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" />{lang === "th" ? "ผู้ที่จัดการได้" : "Who can manage"}</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2"><Badge variant="secondary" className="text-[10px]">admin</Badge><span>{lang === "th" ? "ผู้ดูแลระบบ" : "Workspace admin"}</span></div>
              <div className="flex items-center gap-2"><Badge variant="secondary" className="text-[10px]">dept_admin</Badge><span>{lang === "th" ? "ผู้ดูแลหน่วยงาน" : "Dept admin"}</span></div>
              <p className="pt-2">
                {lang === "th"
                  ? "เฉพาะผู้ที่มีบทบาทข้างต้นเท่านั้นที่แก้ไข ปิด/เปิด หรือลบ Skill นี้ได้"
                  : "Only the roles above can edit, toggle, or delete this skill."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base text-destructive">{lang === "th" ? "เขตอันตราย" : "Danger zone"}</CardTitle></CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="w-full"><Trash2 className="h-3.5 w-3.5 mr-1.5" />{lang === "th" ? "ลบ Skill" : "Delete skill"}</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{lang === "th" ? `ลบ "${skill.name}"?` : `Delete "${skill.name}"?`}</AlertDialogTitle>
                    <AlertDialogDescription>{lang === "th" ? "การลบไม่สามารถกู้คืนได้" : "This cannot be undone."}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{lang === "th" ? "ยกเลิก" : "Cancel"}</AlertDialogCancel>
                    <AlertDialogAction onClick={remove}>{lang === "th" ? "ลบ" : "Delete"}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
