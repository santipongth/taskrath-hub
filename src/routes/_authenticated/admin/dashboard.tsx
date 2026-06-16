import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { executiveStats } from "@/lib/admin.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Activity, Coins, Users, Building2, Download } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  head: () => ({ meta: [{ title: "Executive Dashboard · RathCoWork" }] }),
  component: ExecutiveDashboard,
});

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

function fmtCost(n: number) { return `$${n.toFixed(4)}`; }

function ExecutiveDashboard() {
  const { lang } = useI18n();
  const [days, setDays] = useState(30);
  const fetchStats = useServerFn(executiveStats);
  const { data, isLoading, error } = useQuery({
    queryKey: ["exec-stats", days],
    queryFn: () => fetchStats({ data: { days } }),
  });

  const L = (th: string, en: string) => (lang === "th" ? th : en);

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["Date", "Runs", "Cost (USD)"],
      ...data.daily.map((d) => [d.day, d.runs.toString(), d.cost.toFixed(6)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `taskrath-usage-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : "Forbidden"}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {L("แดชบอร์ดผู้บริหาร", "Executive Dashboard")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {L("ภาพรวมการใช้งาน AI ทั้งหน่วยงาน", "Organization-wide AI usage overview")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border bg-card text-xs">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 ${days === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {d}{L(" วัน", "d")}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!data}>
            <Download className="mr-1.5 h-3.5 w-3.5" />CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi icon={Activity} label={L("งานทั้งหมด", "Total runs")} value={data.totals.runs.toLocaleString()} />
            <Kpi icon={Users} label={L("ผู้ใช้ active", "Active users")} value={data.totals.activeUsers.toLocaleString()} />
            <Kpi icon={Coins} label={L("ต้นทุนรวม", "Total cost")} value={fmtCost(data.totals.costUsd)} sub={`avg ${fmtCost(data.totals.avgCost)}/run`} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Panel title={L("งานตามแผนก", "Runs by department")} icon={Building2}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byDepartment}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="runs" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title={L("สัดส่วนเทมเพลต", "Template mix")}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.byTemplate} dataKey="runs" nameKey="id" cx="50%" cy="50%" outerRadius={80} label={(e) => e.id}>
                      {data.byTemplate.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <Panel title={L("แนวโน้มรายวัน", "Daily trend")} className="mt-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis yAxisId="l" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis yAxisId="r" orientation="right" stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="l" type="monotone" dataKey="runs" stroke="var(--primary)" strokeWidth={2} dot={false} name="Runs" />
                  <Line yAxisId="r" type="monotone" dataKey="cost" stroke="#10b981" strokeWidth={2} dot={false} name="Cost (USD)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 12,
  color: "var(--foreground)",
};

function Kpi({ icon: Icon, label, value, sub }: { icon: typeof Activity; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Panel({ title, icon: Icon, children, className }: { title: string; icon?: typeof Activity; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-border bg-card p-5 ${className ?? ""}`}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        {Icon && <Icon className="h-4 w-4" />}{title}
      </h2>
      {children}
    </section>
  );
}
