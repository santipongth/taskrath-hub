import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listDeptRuns, getDeptAdminInfo } from "@/lib/dept-agents.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, CheckCircle2, XCircle, Clock, DollarSign } from "lucide-react";

export const Route = createFileRoute("/_authenticated/agents/manage/runs")({
  head: () => ({ meta: [{ title: "ประวัติการรันของหน่วยงาน · RathCoWork" }] }),
  component: DeptRunsPage,
});

type RunRow = {
  id: string;
  created_at: string;
  user_id: string;
  title: string | null;
  status: string;
  needs_approval: boolean;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cost_usd: number | null;
  dept_agent_id: string | null;
  dept_skill_id: string | null;
  agent_name: string | null;
  skill_name: string | null;
};

type Stats = { total: number; ok: number; failed: number; pending: number; totalCost: number; totalTokens: number };
type Bucket = { id: string; name: string; total: number; ok: number; failed: number; cost: number };

function DeptRunsPage() {
  const info = useServerFn(getDeptAdminInfo);
  const load = useServerFn(listDeptRuns);
  const [allowed, setAllowed] = useState<null | boolean>(null);
  const [dept, setDept] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [agentId, setAgentId] = useState<string>("__all__");
  const [skillId, setSkillId] = useState<string>("__all__");
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [byAgent, setByAgent] = useState<Bucket[]>([]);
  const [bySkill, setBySkill] = useState<Bucket[]>([]);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [skills, setSkills] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    info({}).then((i) => {
      setAllowed(i.canManage);
      setDept(i.department);
    });
  }, [info]);

  useEffect(() => {
    if (!allowed) return;
    load({
      data: {
        days,
        agentId: agentId === "__all__" ? undefined : agentId,
        skillId: skillId === "__all__" ? undefined : skillId,
      },
    }).then((r) => {
      setRuns(r.runs as RunRow[]);
      setStats(r.stats as Stats | null);
      setByAgent(r.byAgent as Bucket[]);
      setBySkill(r.bySkill as Bucket[]);
      setAgents(r.agents);
      setSkills(r.skills);
    });
  }, [allowed, days, agentId, skillId, load]);

  const successRate = useMemo(() => {
    if (!stats || stats.total === 0) return 0;
    return Math.round((stats.ok / stats.total) * 100);
  }, [stats]);

  if (allowed === null) return <div className="p-6 text-sm text-muted-foreground">กำลังตรวจสอบสิทธิ์…</div>;
  if (!allowed) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-lg font-semibold">ไม่อนุญาต</h1>
        <p className="mt-2 text-sm text-muted-foreground">ต้องเป็น admin ของหน่วยงานจึงจะดูประวัติได้</p>
        <Button asChild className="mt-4" variant="outline" size="sm">
          <Link to="/agents"><ArrowLeft className="h-4 w-4 mr-1" /> กลับ</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">ประวัติการรันของหน่วยงาน</h1>
          <p className="mt-1 text-sm text-muted-foreground">หน่วยงาน: <span className="font-medium text-foreground">{dept}</span></p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/agents/manage"><ArrowLeft className="h-4 w-4 mr-1" /> กลับไปจัดการ</Link>
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground">ช่วงเวลา</label>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 วัน</SelectItem>
              <SelectItem value="30">30 วัน</SelectItem>
              <SelectItem value="90">90 วัน</SelectItem>
              <SelectItem value="180">180 วัน</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Agent</label>
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">ทั้งหมด</SelectItem>
              {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Skill</label>
          <Select value={skillId} onValueChange={setSkillId}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">ทั้งหมด</SelectItem>
              {skills.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="งานทั้งหมด" value={stats?.total ?? 0} />
        <StatCard label="สำเร็จ" value={`${stats?.ok ?? 0} (${successRate}%)`} icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} />
        <StatCard label="ไม่สำเร็จ" value={stats?.failed ?? 0} icon={<XCircle className="h-4 w-4 text-red-500" />} />
        <StatCard label="รออนุมัติ" value={stats?.pending ?? 0} icon={<Clock className="h-4 w-4 text-amber-500" />} />
        <StatCard label="ต้นทุนรวม" value={`$${(stats?.totalCost ?? 0).toFixed(4)}`} icon={<DollarSign className="h-4 w-4 text-blue-500" />} />
      </div>

      <Tabs defaultValue="runs" className="mt-6">
        <TabsList>
          <TabsTrigger value="runs">รายการ ({runs.length})</TabsTrigger>
          <TabsTrigger value="byAgent">สรุปตาม Agent</TabsTrigger>
          <TabsTrigger value="bySkill">สรุปตาม Skill</TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="mt-4">
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">เวลา</th>
                  <th className="px-3 py-2 text-left">Agent / Skill</th>
                  <th className="px-3 py-2 text-left">ประเภท</th>
                  <th className="px-3 py-2 text-left">สถานะ</th>
                  <th className="px-3 py-2 text-right">Tokens</th>
                  <th className="px-3 py-2 text-right">ต้นทุน</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">ยังไม่มีประวัติในช่วงนี้</td></tr>
                )}
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.agent_name ?? r.title ?? "—"}</div>
                      {r.skill_name && <div className="text-[11px] text-muted-foreground">↳ {r.skill_name}</div>}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.skill_name ? "Skill" : "Agent"}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={r.status} needsApproval={r.needs_approval} />
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      {(Number(r.prompt_tokens ?? 0) + Number(r.completion_tokens ?? 0)).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">${Number(r.cost_usd ?? 0).toFixed(4)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/history/$runId" params={{ runId: r.id }}>เปิด</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="byAgent" className="mt-4">
          <BucketTable buckets={byAgent} label="Agent" />
        </TabsContent>
        <TabsContent value="bySkill" className="mt-4">
          <BucketTable buckets={bySkill} label="Skill" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function StatusBadge({ status, needsApproval }: { status: string; needsApproval: boolean }) {
  if (needsApproval) return <Badge variant="outline" className="text-[10px]">รออนุมัติ</Badge>;
  if (status === "completed") return <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">สำเร็จ</Badge>;
  if (status === "failed" || status === "error") return <Badge variant="destructive" className="text-[10px]">ไม่สำเร็จ</Badge>;
  return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
}

function BucketTable({ buckets, label }: { buckets: Bucket[]; label: string }) {
  if (buckets.length === 0) {
    return <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">{label}</th>
            <th className="px-3 py-2 text-right">งาน</th>
            <th className="px-3 py-2 text-right">สำเร็จ</th>
            <th className="px-3 py-2 text-right">ไม่สำเร็จ</th>
            <th className="px-3 py-2 text-right">% สำเร็จ</th>
            <th className="px-3 py-2 text-right">ต้นทุน</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => {
            const pct = b.total > 0 ? Math.round((b.ok / b.total) * 100) : 0;
            return (
              <tr key={b.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{b.name}</td>
                <td className="px-3 py-2 text-right">{b.total}</td>
                <td className="px-3 py-2 text-right text-emerald-600">{b.ok}</td>
                <td className="px-3 py-2 text-right text-red-600">{b.failed}</td>
                <td className="px-3 py-2 text-right">{pct}%</td>
                <td className="px-3 py-2 text-right text-xs">${b.cost.toFixed(4)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
