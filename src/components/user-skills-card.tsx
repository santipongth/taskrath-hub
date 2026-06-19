import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Sparkles, Plus, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { listMySkills, upsertSkill, deleteSkill, seedDefaultSkills, type UserSkill } from "@/lib/user-skills.functions";

export function UserSkillsCard() {
  const qc = useQueryClient();
  const fetchSkills = useServerFn(listMySkills);
  const upsert = useServerFn(upsertSkill);
  const del = useServerFn(deleteSkill);
  const seed = useServerFn(seedDefaultSkills);

  const { data } = useQuery({ queryKey: ["user-skills"], queryFn: () => fetchSkills() });
  const skills: UserSkill[] = data?.skills ?? [];

  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftPrompt, setDraftPrompt] = useState("");

  function startEdit(s: UserSkill | null) {
    if (s) {
      setEditingId(s.id);
      setDraftName(s.name);
      setDraftPrompt(s.role_prompt);
    } else {
      setEditingId("new");
      setDraftName("");
      setDraftPrompt("");
    }
  }
  function cancel() { setEditingId(null); setDraftName(""); setDraftPrompt(""); }

  async function save() {
    if (!draftName.trim() || !draftPrompt.trim()) {
      toast.error("กรอกชื่อและคำสั่งบทบาท");
      return;
    }
    try {
      await upsert({
        data: {
          id: editingId === "new" ? undefined : (editingId ?? undefined),
          name: draftName,
          role_prompt: draftPrompt,
        },
      });
      toast.success("บันทึก Skill แล้ว");
      cancel();
      qc.invalidateQueries({ queryKey: ["user-skills"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ผิดพลาด");
    }
  }

  async function remove(id: string) {
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["user-skills"] });
  }

  async function seedDefaults() {
    await seed();
    qc.invalidateQueries({ queryKey: ["user-skills"] });
    toast.success("เพิ่ม Skill ตัวอย่างแล้ว");
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Skill ส่วนตัว (Role / Instruction)
          </CardTitle>
          <div className="flex gap-1">
            {skills.length === 0 && (
              <Button size="sm" variant="outline" onClick={seedDefaults}>เพิ่ม Skill ตัวอย่าง 8 แบบ</Button>
            )}
            <Button size="sm" onClick={() => startEdit(null)}><Plus className="h-3.5 w-3.5 mr-1" />เพิ่ม</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          สร้างบทบาท/ระบบสั่ง AI ของตัวเอง (เช่น "แปลวิชาการ EN↔TH", "หนังสือราชการ", "Coding Helper") แล้วเลือกใช้ได้จากหน้า สั่งงาน AI และระบบบริหารงาน
        </p>

        {editingId !== null && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
            <Input
              placeholder="ชื่อ Skill เช่น แปลวิชาการ EN↔TH"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              maxLength={80}
            />
            <Textarea
              placeholder="บทบาท/คำสั่งให้ AI ทำตัวเป็นแบบไหน… (system prompt)"
              value={draftPrompt}
              onChange={(e) => setDraftPrompt(e.target.value)}
              rows={4}
              maxLength={4000}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={cancel}><X className="h-3.5 w-3.5 mr-1" />ยกเลิก</Button>
              <Button size="sm" onClick={save}><Save className="h-3.5 w-3.5 mr-1" />บันทึก</Button>
            </div>
          </div>
        )}

        {skills.length === 0 && editingId === null && (
          <p className="text-sm text-muted-foreground py-4 text-center">ยังไม่มี Skill ส่วนตัว</p>
        )}

        <div className="space-y-2">
          {skills.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-2 rounded-md border border-border p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{s.name}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{s.role_prompt}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => startEdit(s)}>แก้</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost"><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>ลบ Skill นี้?</AlertDialogTitle>
                      <AlertDialogDescription>“{s.name}” จะถูกลบถาวร</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove(s.id)}>ลบ</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
