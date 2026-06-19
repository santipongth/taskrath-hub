import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Inbox, Calendar as CalendarIcon, Sparkles, Trash2, Play, CheckCircle2,
  Clock, AlertTriangle, FolderKanban, Wand2, ListTodo, FileDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  listTasks, triageTasks, updateTask, deleteTask, planWeek,
  taskTypeLabel, type Task, type TaskEvent, type SuggestedTool,
} from "@/lib/tasks.functions";
import { listMyProjects } from "@/lib/user-projects.functions";
import { listMySkills, seedDefaultSkills } from "@/lib/user-skills.functions";

export const Route = createFileRoute("/_authenticated/tasks/")({
  head: () => ({ meta: [{ title: "บริหารงาน · RathCoWork" }] }),
  component: TasksPage,
});

const PRIORITY_LABEL: Record<number, { th: string; color: string }> = {
  1: { th: "ด่วน", color: "bg-red-500/10 text-red-600 border-red-500/20" },
  2: { th: "ปกติ", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  3: { th: "ไม่เร่ง", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
};

function TasksPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchTasks = useServerFn(listTasks);
  const triage = useServerFn(triageTasks);
  const update = useServerFn(updateTask);
  const del = useServerFn(deleteTask);
  const plan = useServerFn(planWeek);
  const fetchProjects = useServerFn(listMyProjects);
  const fetchSkills = useServerFn(listMySkills);
  const seedSkills = useServerFn(seedDefaultSkills);

  const [bulkText, setBulkText] = useState("");
  const [busy, setBusy] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [tab, setTab] = useState<"inbox" | "today" | "week" | "done">("inbox");

  const { data: tasksData } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => fetchTasks(),
  });
  const { data: projectsData } = useQuery({
    queryKey: ["user-projects"],
    queryFn: () => fetchProjects(),
  });
  const { data: skillsData } = useQuery({
    queryKey: ["user-skills"],
    queryFn: async () => {
      const r = await fetchSkills();
      if (r.skills.length === 0) {
        await seedSkills();
        return fetchSkills();
      }
      return r;
    },
  });

  const tasks: Task[] = tasksData?.tasks ?? [];
  const events: TaskEvent[] = tasksData?.events ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tasks"] });

  async function handleTriage() {
    if (!bulkText.trim()) return;
    setBusy(true);
    try {
      const r = await triage({ data: { text: bulkText, project_id: projectId } });
      toast.success(`เพิ่ม ${r.inserted} งานเข้า Inbox`);
      setBulkText("");
      invalidate();
      setTab("inbox");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  async function handlePlan() {
    setBusy(true);
    try {
      const r = await plan({ data: { start_hour: 9, end_hour: 17, days: 5, replace: true } });
      toast.success(`จัดตารางลง Calendar แล้ว ${r.scheduled} ช่วงเวลา`);
      invalidate();
      setTab("week");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: Task["status"]) {
    await update({ data: { id, status: status as "inbox" | "planned" | "in_progress" | "done" | "blocked" } });
    invalidate();
  }
  async function removeTask(id: string) {
    await del({ data: { id } });
    invalidate();
  }

  function handleRunTask(t: Task) {
    const tool = (t.suggested_tool as SuggestedTool | null) ?? { kind: "freeform" as const };
    const prompt = tool.prefillPrompt || `${t.title}\n${t.description ?? ""}`.trim();

    if (tool.kind === "template" && tool.ref) {
      navigate({ to: "/run/$templateId", params: { templateId: tool.ref } });
      return;
    }
    if (tool.kind === "research") {
      sessionStorage.setItem("research:prefill", prompt);
      navigate({ to: "/research" });
      return;
    }
    if (tool.kind === "chat") {
      navigate({ to: "/chat" });
      return;
    }
    if (tool.kind === "skill" && skillsData) {
      const match = skillsData.skills.find((s) => s.name === tool.label || s.name === tool.ref);
      if (match) {
        sessionStorage.setItem("run:prefill", JSON.stringify({ prompt, skillId: match.id }));
        navigate({ to: "/run" });
        return;
      }
    }
    sessionStorage.setItem("run:prefill", JSON.stringify({ prompt }));
    navigate({ to: "/run" });
    // mark in progress
    setStatus(t.id, "in_progress");
  }

  // Filtering
  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const todayEnd = useMemo(() => { const d = new Date(todayStart); d.setDate(d.getDate()+1); return d; }, [todayStart]);
  const weekEnd = useMemo(() => { const d = new Date(todayStart); d.setDate(d.getDate()+7); return d; }, [todayStart]);
  const evByTask = useMemo(() => {
    const map = new Map<string, TaskEvent[]>();
    for (const e of events) {
      const arr = map.get(e.task_id) ?? [];
      arr.push(e);
      map.set(e.task_id, arr);
    }
    return map;
  }, [events]);

  const inboxTasks = tasks.filter((t) => t.status === "inbox" || t.status === "in_progress" || t.status === "blocked");
  const doneTasks = tasks.filter((t) => t.status === "done").slice(0, 50);
  const todayEvents = events
    .filter((e) => { const s = new Date(e.start_at); return s >= todayStart && s < todayEnd; })
    .sort((a,b) => a.start_at.localeCompare(b.start_at));
  const weekDays = useMemo(() => {
    const days: Array<{ date: Date; events: Array<TaskEvent & { task?: Task }> }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(todayStart); d.setDate(d.getDate()+i);
      const dEnd = new Date(d); dEnd.setDate(dEnd.getDate()+1);
      const evs = events
        .filter((e) => { const s = new Date(e.start_at); return s >= d && s < dEnd; })
        .map((e) => ({ ...e, task: tasks.find((t) => t.id === e.task_id) }))
        .sort((a,b) => a.start_at.localeCompare(b.start_at));
      days.push({ date: d, events: evs });
    }
    return days;
  }, [events, tasks, todayStart]);

  void weekEnd;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <ListTodo className="h-5 w-5" /> บริหารงาน · AI Workforce
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            โยนงานทั้งหมดเข้ามาในกล่องเดียว ให้ AI แตกงาน จัดลำดับ และส่งต่อให้เครื่องมือที่เหมาะ
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href="/api/public/calendar.ics" target="_blank" rel="noreferrer">
            <FileDown className="h-4 w-4 mr-1" /> Export .ics
          </a>
        </Button>
      </div>

      {/* Triage card */}
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" /> โยนงานเข้ามาทั้งหมด
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={5}
            placeholder={`เช่น:
- พรุ่งนี้ต้องแปลหนังสือเชิญ MOU จากม.โอซาก้า
- สรุปทุน Erasmus+ 2026 ปิดรับ 30 มิ.ย.
- ทำโปสเตอร์งานปฐมนิเทศ นศ.ต่างชาติ A3
- ตอบเมลศาสตราจารย์ญี่ปุ่นเรื่องตารางบรรยาย
- เขียนสคริปต์วิดีโอแนะนำมหาวิทยาลัย 60 วินาที`}
          />
          <div className="flex flex-wrap items-center gap-2">
            {projectsData && projectsData.projects.length > 0 && (
              <Select value={projectId ?? "__none__"} onValueChange={(v) => setProjectId(v === "__none__" ? null : v)}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="ไม่อยู่ในโปรเจกต์" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— ไม่ระบุโปรเจกต์ —</SelectItem>
                  {projectsData.projects.filter((p) => !p.archived).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={handleTriage} disabled={busy || !bulkText.trim()}>
              <Sparkles className="h-4 w-4 mr-1.5" />
              {busy ? "AI กำลังแตกงาน…" : "ให้ AI แตกงาน + จัดลำดับ"}
            </Button>
            <Button variant="secondary" onClick={handlePlan} disabled={busy || inboxTasks.length === 0}>
              <CalendarIcon className="h-4 w-4 mr-1.5" />
              วางแผนลงตาราง (5 วัน)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as "inbox" | "today" | "week" | "done")} className="mt-6">
        <TabsList>
          <TabsTrigger value="inbox">
            <Inbox className="h-4 w-4 mr-1" /> Inbox
            {inboxTasks.length > 0 && <Badge variant="secondary" className="ml-2 text-[10px]">{inboxTasks.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="today">วันนี้ {todayEvents.length > 0 && <Badge variant="secondary" className="ml-2 text-[10px]">{todayEvents.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="week">สัปดาห์นี้</TabsTrigger>
          <TabsTrigger value="done">เสร็จแล้ว</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-4">
          {inboxTasks.length === 0 ? (
            <EmptyState message="ยังไม่มีงานใน Inbox — ลองโยนรายการงานเข้ามาด้านบน" />
          ) : (
            <div className="space-y-2">
              {inboxTasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  events={evByTask.get(t.id) ?? []}
                  onRun={() => handleRunTask(t)}
                  onDone={() => setStatus(t.id, "done")}
                  onDelete={() => removeTask(t.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="today" className="mt-4">
          {todayEvents.length === 0 ? (
            <EmptyState message="วันนี้ยังไม่มีตาราง — กด “วางแผนลงตาราง”" />
          ) : (
            <div className="space-y-2">
              {todayEvents.map((e) => {
                const t = tasks.find((x) => x.id === e.task_id);
                if (!t) return null;
                return (
                  <EventRow key={e.id} event={e} task={t}
                    onRun={() => handleRunTask(t)}
                    onDone={() => setStatus(t.id, "done")} />
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="week" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            {weekDays.map((d) => (
              <div key={d.date.toISOString()} className="rounded-lg border border-border bg-card p-3 min-h-[160px]">
                <div className="text-xs font-semibold text-foreground mb-2">
                  {d.date.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" })}
                </div>
                <div className="space-y-1.5">
                  {d.events.length === 0 && <div className="text-[11px] text-muted-foreground">ว่าง</div>}
                  {d.events.map((e) => (
                    <div key={e.id} className="rounded border border-border bg-background p-2 text-[11px]">
                      <div className="font-medium text-foreground truncate">{e.task?.title ?? "งาน"}</div>
                      <div className="text-muted-foreground">
                        {new Date(e.start_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                        {" – "}
                        {new Date(e.end_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="done" className="mt-4">
          {doneTasks.length === 0 ? (
            <EmptyState message="ยังไม่มีงานที่เสร็จ" />
          ) : (
            <div className="space-y-1.5">
              {doneTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-sm text-muted-foreground py-1.5 px-2 rounded border border-border/50">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="line-through">{t.title}</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">{taskTypeLabel(t.type)}</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Skills hint */}
      {skillsData && skillsData.skills.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderKanban className="h-4 w-4" /> Skill ส่วนตัวที่ใช้ได้
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {skillsData.skills.map((s) => (
                <Badge key={s.id} variant="outline" className="text-[11px]">{s.name}</Badge>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">จัดการ skill ส่วนตัวได้ที่ <Link to="/settings" className="text-primary underline">หน้าตั้งค่า</Link></p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function TaskRow({
  task, events, onRun, onDone, onDelete,
}: { task: Task; events: TaskEvent[]; onRun: () => void; onDone: () => void; onDelete: () => void }) {
  const prio = PRIORITY_LABEL[task.priority] ?? PRIORITY_LABEL[2];
  const tool = task.suggested_tool;
  const isOverdue = task.due_at && new Date(task.due_at) < new Date() && task.status !== "done";
  return (
    <div className="rounded-lg border border-border bg-card p-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-foreground">{task.title}</span>
          <Badge variant="outline" className={`text-[10px] ${prio.color}`}>P{task.priority} · {prio.th}</Badge>
          <Badge variant="secondary" className="text-[10px]">{taskTypeLabel(task.type)}</Badge>
          {task.est_minutes && (
            <Badge variant="outline" className="text-[10px]"><Clock className="h-2.5 w-2.5 mr-0.5" />{task.est_minutes}น.</Badge>
          )}
          {task.due_at && (
            <Badge variant={isOverdue ? "destructive" : "outline"} className="text-[10px]">
              {isOverdue && <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
              ครบกำหนด {new Date(task.due_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
            </Badge>
          )}
          {task.status === "in_progress" && <Badge className="text-[10px]">กำลังทำ</Badge>}
        </div>
        {task.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{task.description}</p>}
        {tool && (
          <p className="mt-1 text-[11px] text-primary">
            แนะนำ: {tool.kind === "template" ? `เทมเพลต ${tool.ref}` : tool.kind === "skill" ? `Skill "${tool.label ?? tool.ref}"` : tool.kind === "research" ? "Deep Research" : tool.kind === "chat" ? "ถามกับ KB" : tool.kind === "external" ? "ทำเองนอกระบบ" : "สั่งงาน AI"}
          </p>
        )}
        {events.length > 0 && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            <CalendarIcon className="h-2.5 w-2.5 inline mr-0.5" />
            {new Date(events[0].start_at).toLocaleString("th-TH", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        {tool?.kind !== "external" && (
          <Button size="sm" variant="default" onClick={onRun}>
            <Play className="h-3 w-3 mr-1" /> ทำเลย
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onDone}>
          <CheckCircle2 className="h-3.5 w-3.5" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost"><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ลบงานนี้?</AlertDialogTitle>
              <AlertDialogDescription>“{task.title}” จะถูกลบถาวร</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>ลบ</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function EventRow({ event, task, onRun, onDone }: { event: TaskEvent; task: Task; onRun: () => void; onDone: () => void }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
      <div className="text-xs font-mono text-muted-foreground w-28 shrink-0">
        {new Date(event.start_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
        {" – "}
        {new Date(event.end_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-foreground truncate">{task.title}</div>
        <div className="text-[11px] text-muted-foreground">{taskTypeLabel(task.type)}</div>
      </div>
      <Button size="sm" variant="default" onClick={onRun}><Play className="h-3 w-3 mr-1" />ทำ</Button>
      <Button size="sm" variant="outline" onClick={onDone}><CheckCircle2 className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

// Unused export to satisfy strict checks on label imports
void Label; void Input; void Switch;
