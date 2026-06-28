import { createFileRoute, Link, redirect, isRedirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listSharedSkillsForAdmin,
  upsertSharedSkill,
  deleteSharedSkill,
  type SharedSkill,
} from "@/lib/shared-skills.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ArrowLeft, Sparkles, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/skills/manage")({
  head: () => ({ meta: [{ title: "จัดการ Skill · RathCoWork" }] }),
  loader: async () => {
    try {
      return await listSharedSkillsForAdmin();
    } catch (e) {
      if (isRedirect(e)) throw e;
      return { skills: [], department: null, error: "load_failed" as const };
    }
  },
  component: SkillsManagePage,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">ไม่สามารถโหลดหน้าจัดการ Skill ได้ โปรดตรวจสอบสิทธิ์ผู้ดูแลหน่วยงาน</div>
  ),
});


type Draft = {
  id?: string;
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

const EMPTY: Draft = {
  name: "",
  icon: "",
  category: "",
  description: "",
  example_output: "",
  role_prompt: "",
  default_model_selector: "",
  sort_order: 0,
  is_active: true,
};

function SkillsManagePage() {
  const { lang } = useI18n();
  const qc = useQueryClient();
  const fetchAll = useServerFn(listSharedSkillsForAdmin);
  const upsert = useServerFn(upsertSharedSkill);
  const del = useServerFn(deleteSharedSkill);

  const { data } = useQuery({
    queryKey: ["shared-skills-admin"],
    queryFn: () => fetchAll(),
  });
  const skills: SharedSkill[] = data?.skills ?? [];
  const loadError = (data as { error?: string | null } | undefined)?.error ?? null;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);



  const openCreate = () => setDraft({ ...EMPTY });
  const openEdit = (s: SharedSkill) =>
    setDraft({
      id: s.id,
      name: s.name,
      icon: s.icon ?? "",
      category: s.category ?? "",
      description: s.description ?? "",
      example_output: s.example_output ?? "",
      role_prompt: s.role_prompt,
      default_model_selector: s.default_model_selector ?? "",
      sort_order: s.sort_order,
      is_active: s.is_active,
    });

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.role_prompt.trim()) {
      toast.error(lang === "th" ? "กรอกชื่อและบทบาท" : "Name and role prompt required");
      return;
    }
    setSaving(true);
    try {
      await upsert({
        data: {
          id: draft.id,
          name: draft.name,
          icon: draft.icon || null,
          category: draft.category || null,
          description: draft.description || null,
          example_output: draft.example_output || null,
          role_prompt: draft.role_prompt,
          default_model_selector: draft.default_model_selector || null,
          sort_order: draft.sort_order,
          is_active: draft.is_active,
        },
      });
      toast.success(lang === "th" ? "บันทึกแล้ว" : "Saved");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["shared-skills-admin"] });
      qc.invalidateQueries({ queryKey: ["shared-skills"] });
      qc.invalidateQueries({ queryKey: ["available-skills"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await del({ data: { id } });
      qc.invalidateQueries({ queryKey: ["shared-skills-admin"] });
      qc.invalidateQueries({ queryKey: ["shared-skills"] });
      qc.invalidateQueries({ queryKey: ["available-skills"] });
      toast.success(lang === "th" ? "ลบแล้ว" : "Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link to="/skills"><ArrowLeft className="h-3.5 w-3.5 mr-1" />{lang === "th" ? "กลับคลัง Skill" : "Back to library"}</Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> {lang === "th" ? "จัดการคลัง Skill" : "Manage Skill Library"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === "th"
              ? "สร้าง Skill กลางที่ทุกคนเรียกใช้ได้ผ่านเมนู Skills, สั่งงาน AI, และวิจัยเชิงลึก"
              : "Create shared skills usable from Skills, Run, and Deep Research."}
          </p>
        </div>

        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" />{lang === "th" ? "สร้าง Skill" : "New skill"}</Button>
      </header>

      {skills.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {lang === "th" ? "ยังไม่มี Skill — เริ่มจากกด 'สร้าง Skill'" : "No skills yet — click 'New skill' to start"}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {skills.map((s) => (
            <Card key={s.id} className={s.is_active ? "" : "opacity-60"}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base flex items-center gap-2">
                      {s.name}
                      {!s.is_active && <Badge variant="outline" className="text-[10px]">{lang === "th" ? "ปิดใช้" : "off"}</Badge>}
                      {s.category && <Badge variant="secondary" className="text-[10px]">{s.category}</Badge>}
                    </CardTitle>
                    {s.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{s.description}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost"><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{lang === "th" ? `ลบ "${s.name}"?` : `Delete "${s.name}"?`}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {lang === "th" ? "การลบไม่สามารถกู้คืนได้" : "This cannot be undone."}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{lang === "th" ? "ยกเลิก" : "Cancel"}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(s.id)}>{lang === "th" ? "ลบ" : "Delete"}</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {draft && (
            <>
              <SheetHeader>
                <SheetTitle>{draft.id ? (lang === "th" ? "แก้ Skill" : "Edit skill") : (lang === "th" ? "สร้าง Skill ใหม่" : "New skill")}</SheetTitle>
                <SheetDescription>
                  {lang === "th" ? "Skill จะถูกแชร์ให้ทุกคนในหน่วยงานเรียกใช้" : "Will be shared with everyone in your department."}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-3">
                <div>
                  <Label className="text-xs">{lang === "th" ? "ชื่อ Skill" : "Name"} *</Label>
                  <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={80} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">{lang === "th" ? "หมวด" : "Category"}</Label>
                    <Input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} maxLength={60} placeholder={lang === "th" ? "เช่น สารบรรณ, วิเทศ" : "e.g. Docs, Comms"} />
                  </div>
                  <div>
                    <Label className="text-xs">{lang === "th" ? "ลำดับ" : "Sort order"}</Label>
                    <Input type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">{lang === "th" ? "คำอธิบายสั้น" : "Description"}</Label>
                  <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={500} />
                </div>
                <div>
                  <Label className="text-xs">{lang === "th" ? "บทบาท / System prompt" : "Role prompt"} *</Label>
                  <Textarea rows={6} value={draft.role_prompt} onChange={(e) => setDraft({ ...draft, role_prompt: e.target.value })} maxLength={6000} placeholder={lang === "th" ? "คุณคือ…" : "You are…"} />
                </div>
                <div>
                  <Label className="text-xs">{lang === "th" ? "ตัวอย่างผลลัพธ์ (ทางเลือก)" : "Example output (optional)"}</Label>
                  <Textarea rows={3} value={draft.example_output} onChange={(e) => setDraft({ ...draft, example_output: e.target.value })} maxLength={4000} />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border p-2">
                  <div>
                    <Label className="text-xs">{lang === "th" ? "เปิดใช้งาน" : "Active"}</Label>
                    <p className="text-[11px] text-muted-foreground">
                      {lang === "th" ? "ปิดเพื่อซ่อนจากผู้ใช้ชั่วคราว" : "Turn off to hide from members"}
                    </p>
                  </div>
                  <Switch checked={draft.is_active} onCheckedChange={(c) => setDraft({ ...draft, is_active: c })} />
                </div>
              </div>

              <SheetFooter className="mt-4">
                <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>{lang === "th" ? "ยกเลิก" : "Cancel"}</Button>
                <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1.5" />{lang === "th" ? "บันทึก" : "Save"}</Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
