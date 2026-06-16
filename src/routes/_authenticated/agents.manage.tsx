import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listDeptSkills,
  upsertDeptSkill,
  deleteDeptSkill,
  listDeptAgents,
  upsertDeptAgent,
  deleteDeptAgent,
  getDeptAdminInfo,
  type DeptSkill,
  type DeptAgent,
} from "@/lib/dept-agents.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, ArrowLeft, Wrench, Bot, BarChart3, Wand2, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/agents/manage")({
  head: () => ({ meta: [{ title: "จัดการ Agent หน่วยงาน · RathCoWork" }] }),
  component: ManagePage,
});

type FieldDef = { key: string; label: string; type?: string; required?: boolean; placeholder?: string; example?: string };

const FIELD_TYPES: Array<{ value: string; label: string; placeholder: string; example: string }> = [
  { value: "text", label: "ข้อความสั้น", placeholder: "พิมพ์ข้อความ…", example: "ตัวอย่างค่า" },
  { value: "textarea", label: "ข้อความยาว", placeholder: "พิมพ์เนื้อหา…", example: "เนื้อหายาว ๆ หลายบรรทัด" },
  { value: "number", label: "ตัวเลข", placeholder: "เช่น 1000", example: "1000" },
  { value: "date", label: "วันที่", placeholder: "YYYY-MM-DD", example: "2026-06-16" },
  { value: "email", label: "อีเมล", placeholder: "name@example.com", example: "[email protected]" },
  { value: "url", label: "ลิงก์ URL", placeholder: "https://…", example: "https://example.com" },
];

const FIELD_PRESETS: FieldDef[] = [
  { key: "subject", label: "เรื่อง", type: "text", required: true, placeholder: "หัวเรื่อง", example: "ขออนุมัติงบประมาณ" },
  { key: "to", label: "เรียน", type: "text", required: true, placeholder: "ผู้รับ", example: "ผู้อำนวยการสำนักงาน" },
  { key: "body", label: "เนื้อหา", type: "textarea", required: true, placeholder: "รายละเอียด…", example: "อธิบายเหตุผลและรายละเอียดประกอบ" },
  { key: "ref_no", label: "เลขที่อ้างอิง", type: "text", placeholder: "เช่น มท 0123/2569", example: "มท 0123/2569" },
  { key: "amount", label: "จำนวนเงิน (บาท)", type: "number", placeholder: "0", example: "10000" },
  { key: "due_date", label: "วันครบกำหนด", type: "date", placeholder: "YYYY-MM-DD", example: "2026-07-01" },
];

export function validateFieldValue(f: FieldDef, raw: string): string | null {
  const v = (raw ?? "").trim();
  if (f.required && !v) return "ต้องกรอก";
  if (!v) return null;
  if (f.type === "number" && !/^-?\d+(\.\d+)?$/.test(v)) return "ต้องเป็นตัวเลข";
  if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "อีเมลไม่ถูกต้อง";
  if (f.type === "url" && !/^https?:\/\/\S+/i.test(v)) return "URL ต้องขึ้นต้นด้วย http(s)://";
  if (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return "รูปแบบวันที่: YYYY-MM-DD";
  return null;
}


function ManagePage() {
  const navigate = useNavigate();
  const info = useServerFn(getDeptAdminInfo);
  const [allowed, setAllowed] = useState<null | boolean>(null);
  const [dept, setDept] = useState<string | null>(null);

  useEffect(() => {
    info({}).then((i) => {
      setAllowed(i.canManage);
      setDept(i.department);
      if (!i.canManage) {
        toast.error("ต้องเป็น admin ของหน่วยงานจึงจะเข้าหน้านี้ได้");
      }
    });
  }, [info]);

  if (allowed === null) {
    return <div className="p-6 text-sm text-muted-foreground">กำลังตรวจสอบสิทธิ์…</div>;
  }
  if (!allowed) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-lg font-semibold">ไม่อนุญาต</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {dept
            ? `หน่วยงานของคุณ: ${dept} — แต่บัญชีนี้ยังไม่มีสิทธิ์ dept_admin`
            : "บัญชีนี้ยังไม่ได้กำหนดหน่วยงาน — ติดต่อผู้ดูแลระบบ"}
        </p>
        <Button asChild className="mt-4" variant="outline" size="sm">
          <Link to="/agents"><ArrowLeft className="h-4 w-4 mr-1" /> กลับ</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">จัดการ Agent &amp; Skill</h1>
          <p className="mt-1 text-sm text-muted-foreground">หน่วยงาน: <span className="font-medium text-foreground">{dept}</span></p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/agents" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
        </Button>
      </div>

      <Tabs defaultValue="agents" className="mt-6">
        <TabsList>
          <TabsTrigger value="agents"><Bot className="h-4 w-4 mr-1" /> Agents</TabsTrigger>
          <TabsTrigger value="skills"><Wrench className="h-4 w-4 mr-1" /> Skills</TabsTrigger>
        </TabsList>
        <TabsContent value="agents" className="mt-4">
          <AgentsTab />
        </TabsContent>
        <TabsContent value="skills" className="mt-4">
          <SkillsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ───────────────────────── Skills ─────────────────────────
function SkillsTab() {
  const list = useServerFn(listDeptSkills);
  const upsert = useServerFn(upsertDeptSkill);
  const del = useServerFn(deleteDeptSkill);
  const [skills, setSkills] = useState<DeptSkill[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DeptSkill | null>(null);

  const reload = () => list({}).then((r) => setSkills(r.skills));
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const onSave = async (s: Partial<DeptSkill> & { fields: FieldDef[] }) => {
    try {
      await upsert({ data: {
        id: editing?.id,
        name: s.name ?? "",
        description: s.description ?? null,
        system_prompt: s.system_prompt ?? "",
        fields: s.fields ?? [],
        kb_category: s.kb_category ?? null,
        model: s.model ?? null,
        needs_approval: !!s.needs_approval,
        status: (s.status as "active" | "draft") ?? "active",
      }});
      toast.success("บันทึก skill แล้ว");
      setOpen(false);
      setEditing(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("ลบ skill นี้?")) return;
    try {
      await del({ data: { id } });
      toast.success("ลบแล้ว");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> สร้าง Skill
        </Button>
      </div>
      <div className="space-y-2">
        {skills.length === 0 && (
          <p className="text-sm text-muted-foreground">ยังไม่มี skill — เริ่มสร้างได้เลย</p>
        )}
        {skills.map((s) => (
          <div key={s.id} className="rounded-md border border-border bg-card p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{s.name}</h3>
                <Badge variant={s.status === "active" ? "default" : "secondary"} className="text-[10px]">{s.status}</Badge>
                {s.needs_approval && <Badge variant="outline" className="text-[10px]">ต้องอนุมัติ</Badge>}
              </div>
              {s.description && <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>}
              <p className="mt-1 text-[11px] text-muted-foreground">fields: {s.fields.length} · KB: {s.kb_category ?? "—"}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => { setEditing(s); setOpen(true); }}>แก้ไข</Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(s.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>

      <SkillEditor open={open} onOpenChange={setOpen} initial={editing} onSave={onSave} />
    </>
  );
}

function SkillEditor({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: DeptSkill | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSave: (s: any) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [kbCategory, setKbCategory] = useState("");
  const [needsApproval, setNeedsApproval] = useState(false);
  const [status, setStatus] = useState<"active" | "draft">("active");

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setSystemPrompt(initial?.system_prompt ?? "");
    setFields(initial?.fields ?? []);
    setKbCategory(initial?.kb_category ?? "");
    setNeedsApproval(!!initial?.needs_approval);
    setStatus((initial?.status as "active" | "draft") ?? "active");
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "แก้ไข Skill" : "สร้าง Skill ใหม่"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>ชื่อ skill *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น สรุปรายงานประจำเดือน" />
            </div>
            <div>
              <Label>KB category (ทางเลือก)</Label>
              <Input value={kbCategory} onChange={(e) => setKbCategory(e.target.value)} placeholder="เช่น hr, finance" />
            </div>
          </div>
          <div>
            <Label>คำอธิบาย</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>System prompt</Label>
            <Textarea rows={5} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="คุณคือ…" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Fields (ช่องกรอกข้อมูล)</Label>
              <Button size="sm" variant="outline" onClick={() => setFields([...fields, { key: "", label: "", type: "text" }])}>
                <Plus className="h-3 w-3 mr-1" /> เพิ่ม field
              </Button>
            </div>
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <Input className="col-span-3" placeholder="key" value={f.key}
                    onChange={(e) => setFields(fields.map((x, j) => j === i ? { ...x, key: e.target.value } : x))} />
                  <Input className="col-span-6" placeholder="ป้ายแสดงผล" value={f.label}
                    onChange={(e) => setFields(fields.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                  <label className="col-span-2 flex items-center gap-1 text-xs">
                    <Checkbox checked={!!f.required} onCheckedChange={(v) => setFields(fields.map((x, j) => j === i ? { ...x, required: !!v } : x))} />
                    บังคับ
                  </label>
                  <Button variant="ghost" size="icon" className="col-span-1" onClick={() => setFields(fields.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={needsApproval} onCheckedChange={setNeedsApproval} />
              ต้องผ่านการอนุมัติ
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={status === "active"} onCheckedChange={(v) => setStatus(v ? "active" : "draft")} />
              เปิดใช้งาน
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={() => onSave({ name, description, system_prompt: systemPrompt, fields, kb_category: kbCategory || null, needs_approval: needsApproval, status })} disabled={!name.trim()}>
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────── Agents ─────────────────────────
function AgentsTab() {
  const listA = useServerFn(listDeptAgents);
  const listS = useServerFn(listDeptSkills);
  const upsert = useServerFn(upsertDeptAgent);
  const del = useServerFn(deleteDeptAgent);
  const [agents, setAgents] = useState<DeptAgent[]>([]);
  const [skills, setSkills] = useState<DeptSkill[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DeptAgent | null>(null);

  const reload = async () => {
    const [a, s] = await Promise.all([listA({}), listS({})]);
    setAgents(a.agents);
    setSkills(s.skills);
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const onSave = async (payload: { name: string; description: string | null; role_prompt: string; skill_ids: string[]; status: "active" | "draft" }) => {
    try {
      await upsert({ data: { id: editing?.id, ...payload } });
      toast.success("บันทึก agent แล้ว");
      setOpen(false);
      setEditing(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("ลบ agent นี้?")) return;
    try {
      await del({ data: { id } });
      toast.success("ลบแล้ว");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> สร้าง Agent
        </Button>
      </div>
      <div className="space-y-2">
        {agents.length === 0 && (
          <p className="text-sm text-muted-foreground">ยังไม่มี agent — สร้าง skill ก่อนแล้วผูกเข้า agent</p>
        )}
        {agents.map((a) => (
          <div key={a.id} className="rounded-md border border-border bg-card p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{a.name}</h3>
                <Badge variant={a.status === "active" ? "default" : "secondary"} className="text-[10px]">{a.status}</Badge>
              </div>
              {a.description && <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>}
              <div className="mt-2 flex flex-wrap gap-1">
                {(a.skills ?? []).map((s) => (
                  <span key={s.id} className="rounded bg-muted px-2 py-0.5 text-[11px]">{s.name}</span>
                ))}
                {(a.skills ?? []).length === 0 && <span className="text-[11px] text-muted-foreground">ยังไม่มี skill</span>}
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => { setEditing(a); setOpen(true); }}>แก้ไข</Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(a.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
      <AgentEditor open={open} onOpenChange={setOpen} initial={editing} skills={skills} onSave={onSave} />
    </>
  );
}

function AgentEditor({
  open,
  onOpenChange,
  initial,
  skills,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: DeptAgent | null;
  skills: DeptSkill[];
  onSave: (p: { name: string; description: string | null; role_prompt: string; skill_ids: string[]; status: "active" | "draft" }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rolePrompt, setRolePrompt] = useState("");
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"active" | "draft">("active");

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setRolePrompt(initial?.role_prompt ?? "");
    setSkillIds((initial?.skills ?? []).map((s) => s.id));
    setStatus((initial?.status as "active" | "draft") ?? "active");
  }, [open, initial]);

  const toggleSkill = (id: string) => {
    setSkillIds(skillIds.includes(id) ? skillIds.filter((x) => x !== id) : [...skillIds, id]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "แก้ไข Agent" : "สร้าง Agent ใหม่"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>ชื่อ agent *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ผู้ช่วยงานสารบรรณ" />
          </div>
          <div>
            <Label>คำอธิบาย</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>บทบาท / Role prompt</Label>
            <Textarea rows={5} value={rolePrompt} onChange={(e) => setRolePrompt(e.target.value)}
              placeholder="คุณคือผู้ช่วยที่เชี่ยวชาญด้าน… มีหน้าที่… ตอบด้วยรูปแบบ…" />
          </div>
          <div>
            <Label className="mb-2 block">Skills ที่ใช้ได้</Label>
            {skills.length === 0 ? (
              <p className="text-xs text-muted-foreground">ยังไม่มี skill — สร้างจากแท็บ Skills ก่อน</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {skills.map((s) => (
                  <label key={s.id} className="flex items-start gap-2 rounded border border-border p-2 cursor-pointer">
                    <Checkbox checked={skillIds.includes(s.id)} onCheckedChange={() => toggleSkill(s.id)} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{s.name}</p>
                      {s.description && <p className="text-[11px] text-muted-foreground truncate">{s.description}</p>}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={status === "active"} onCheckedChange={(v) => setStatus(v ? "active" : "draft")} />
            เปิดใช้งาน
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button
            onClick={() => onSave({
              name, description: description || null, role_prompt: rolePrompt, skill_ids: skillIds, status,
            })}
            disabled={!name.trim()}
          >บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
