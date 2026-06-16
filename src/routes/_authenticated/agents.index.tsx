import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AGENTS, runAgent } from "@/lib/ai.functions";
import {
  listDeptAgents,
  runDeptAgent,
  getDeptAdminInfo,
  type DeptAgent,
  type DeptSkill,
} from "@/lib/dept-agents.functions";
import { useI18n } from "@/lib/i18n";
import { Bot, Copy, Sparkles, ExternalLink, Settings2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { VoiceInputButton } from "@/components/voice-input-button";

export const Route = createFileRoute("/_authenticated/agents/")({
  head: () => ({ meta: [{ title: "Agents · RathCoWork" }] }),
  component: AgentsPage,
});

function AgentsPage() {
  const { t, lang } = useI18n();
  const run = useServerFn(runAgent);
  const runDept = useServerFn(runDeptAgent);
  const listDept = useServerFn(listDeptAgents);
  const info = useServerFn(getDeptAdminInfo);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [deptAgents, setDeptAgents] = useState<DeptAgent[]>([]);
  const [department, setDepartment] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [activeDept, setActiveDept] = useState<DeptAgent | null>(null);
  const [activeSkill, setActiveSkill] = useState<DeptSkill | null>(null);
  const [skillFields, setSkillFields] = useState<Record<string, string>>({});

  useEffect(() => {
    listDept({}).then((r) => {
      setDeptAgents(r.agents);
      setDepartment(r.department);
    });
    info({}).then((i) => setCanManage(i.canManage));
  }, [listDept, info]);

  const active = AGENTS.find((a) => a.id === activeId) ?? null;

  const onPick = (id: string) => {
    setActiveId(id);
    setActiveDept(null);
    setActiveSkill(null);
    setOutput("");
    setRunId(null);
    setPrompt("");
  };

  const onPickDept = (a: DeptAgent) => {
    setActiveDept(a);
    setActiveSkill(null);
    setActiveId(null);
    setOutput("");
    setRunId(null);
    setPrompt("");
    setSkillFields({});
  };

  const onRun = async () => {
    if (!active || !prompt.trim()) return;
    setLoading(true);
    setOutput("");
    setRunId(null);
    try {
      const res = await run({ data: { agentId: active.id, prompt } });
      setOutput(res.output);
      setRunId(res.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const onRunDept = async () => {
    if (!activeDept || !prompt.trim()) return;
    setLoading(true);
    setOutput("");
    setRunId(null);
    try {
      const res = await runDept({
        data: {
          agentId: activeDept.id,
          skillId: activeSkill?.id,
          prompt,
          fields: skillFields,
        },
      });
      setOutput(res.output);
      setRunId(res.id);
      if (res.needsApproval) {
        toast.success("ส่งเข้าคิวอนุมัติแล้ว");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("agentsTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("agentsDesc")}</p>
        </div>
        {canManage && (
          <Button asChild variant="outline" size="sm">
            <Link to="/agents/manage"><Settings2 className="h-4 w-4 mr-1" /> จัดการ Agent หน่วยงาน</Link>
          </Button>
        )}
      </div>

      <Tabs defaultValue={deptAgents.length > 0 ? "dept" : "builtin"} className="mt-6">
        <TabsList>
          <TabsTrigger value="builtin">Built-in</TabsTrigger>
          <TabsTrigger value="dept">
            <Building2 className="h-4 w-4 mr-1" />
            หน่วยงาน{department ? ` · ${department}` : ""}
            {deptAgents.length > 0 && <Badge variant="secondary" className="ml-2 text-[10px]">{deptAgents.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builtin" className="mt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {AGENTS.map((a) => {
              const isActive = a.id === activeId;
              return (
                <button
                  key={a.id}
                  onClick={() => onPick(a.id)}
                  className={`text-left rounded-lg border bg-card p-5 transition-colors ${
                    isActive ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-primary">
                      <Bot className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {lang === "th" ? a.titleTh : a.titleEn}
                    </h3>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {lang === "th" ? a.descTh : a.descEn}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {a.skills.map((s) => (
                      <span key={s} className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{s}</span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="dept" className="mt-4">
          {!department && (
            <p className="text-sm text-muted-foreground">
              บัญชีนี้ยังไม่ถูกกำหนดหน่วยงาน — ติดต่อผู้ดูแลระบบเพื่อกำหนดหน่วยงานในโปรไฟล์
            </p>
          )}
          {department && deptAgents.length === 0 && (
            <div className="rounded-md border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">หน่วยงาน <b>{department}</b> ยังไม่มี agent</p>
              {canManage && (
                <Button asChild className="mt-3" size="sm">
                  <Link to="/agents/manage">เริ่มสร้าง Agent</Link>
                </Button>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {deptAgents.filter((a) => a.status === "active").map((a) => {
              const isActive = a.id === activeDept?.id;
              return (
                <button
                  key={a.id}
                  onClick={() => onPickDept(a)}
                  className={`text-left rounded-lg border bg-card p-5 transition-colors ${
                    isActive ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-primary">
                      <Bot className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">{a.name}</h3>
                  </div>
                  {a.description && <p className="mt-2 text-xs text-muted-foreground">{a.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(a.skills ?? []).filter((s) => s.status === "active").map((s) => (
                      <span key={s.id} className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{s.name}</span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {(active || activeDept) && (
        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">
              {active
                ? (lang === "th" ? `สั่งงาน ${active.titleTh}` : `Task ${active.titleEn}`)
                : `สั่งงาน ${activeDept?.name}`}
            </h2>
          </div>

          {activeDept && (activeDept.skills ?? []).filter((s) => s.status === "active").length > 0 && (
            <div className="mb-3">
              <Label className="text-xs">Skill (ไม่บังคับ)</Label>
              <Select
                value={activeSkill?.id ?? "__none__"}
                onValueChange={(v) => {
                  const s = (activeDept.skills ?? []).find((x) => x.id === v) ?? null;
                  setActiveSkill(s);
                  setSkillFields({});
                }}
              >
                <SelectTrigger><SelectValue placeholder="เลือก skill" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— ใช้แค่ role prompt —</SelectItem>
                  {(activeDept.skills ?? []).filter((s) => s.status === "active").map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {activeSkill && activeSkill.fields.length > 0 && (
            <div className="mb-3 grid gap-2">
              {activeSkill.fields.map((f) => (
                <div key={f.key}>
                  <Label className="text-xs">{f.label}{f.required && " *"}</Label>
                  <Input
                    value={skillFields[f.key] ?? ""}
                    onChange={(e) => setSkillFields({ ...skillFields, [f.key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="relative">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              placeholder={active?.placeholderTh ?? "พิมพ์คำสั่ง / ข้อมูลที่ต้องการ…"}
              className="resize-none pr-10"
            />
            <div className="absolute right-1.5 top-1.5">
              <VoiceInputButton
                size="icon"
                onTranscript={(text, isFinal) => {
                  if (!isFinal) return;
                  setPrompt((p) => (p ? p + " " : "") + text);
                }}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={active ? onRun : onRunDept} disabled={loading || !prompt.trim()}>
              {loading ? t("running") : t("run")}
            </Button>
          </div>

          {output && (
            <div className="mt-5 rounded-md border border-border bg-background p-4">
              <div className="mb-2 flex items-center justify-between">
                <Badge variant="secondary" className="text-[10px]">{t("result")}</Badge>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(output);
                      toast.success(t("copied"));
                    }}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    {t("copy")}
                  </Button>
                  {runId && (
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/history/$runId" params={{ runId }}>
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        {lang === "th" ? "เปิดในประวัติ" : "Open in history"}
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
              <pre className="whitespace-pre-wrap text-sm text-foreground">{output}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
