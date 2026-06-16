import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { adminUsageStats, adminMonthlyReport } from "@/lib/ai.functions";
import { buildMonthlyCsv, buildMonthlyPdf, downloadBlob, reportFilename } from "@/lib/admin-report";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BarChart3, Coins, Activity, Users, AlertTriangle, FileDown, FileText, Loader2 } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/admin/usage")({
  head: () => ({ meta: [{ title: "การใช้งาน · RathCoWork Admin" }] }),
  component: AdminUsagePage,
});

function fmtCost(n: number) {
  return `$${n.toFixed(4)}`;
}
function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function AdminUsagePage() {
  const { lang } = useI18n();
  const fetchStats = useServerFn(adminUsageStats);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-usage"],
    queryFn: () => fetchStats(),
  });

  const L = (th: string, en: string) => (lang === "th" ? th : en);

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
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <BarChart3 className="h-5 w-5 text-primary" />
          {L("การใช้งาน AI (30 วันล่าสุด)", "AI Usage (last 30 days)")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {L("สรุปจำนวนงาน โทเค็น และต้นทุนของทั้งระบบ", "System-wide runs, tokens, and cost")}
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard icon={Activity} label={L("งานทั้งหมด", "Total runs")} value={data.totals.runs.toLocaleString()} />
            <StatCard icon={BarChart3} label={L("โทเค็น (input)", "Prompt tokens")} value={fmtTokens(data.totals.promptTokens)} />
            <StatCard icon={BarChart3} label={L("โทเค็น (output)", "Completion tokens")} value={fmtTokens(data.totals.completionTokens)} />
            <StatCard icon={Coins} label={L("ต้นทุนรวม", "Total cost")} value={fmtCost(data.totals.costUsd)} />
            <StatCard
              icon={AlertTriangle}
              label={L("อัตรา fail", "Fail rate")}
              value={`${(data.totals.failRate * 100).toFixed(1)}% (${data.totals.fails})`}
            />
          </div>

          <section className="mt-8 rounded-lg border border-border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              {L("ต้นทุนรายวัน", "Daily cost")}
            </h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      fontSize: 12,
                      color: "var(--foreground)",
                    }}
                    formatter={(v: number, name: string) => [name === "cost" ? fmtCost(v) : v, name]}
                  />
                  <Line type="monotone" dataKey="cost" stroke="var(--primary)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="runs" stroke="var(--muted-foreground)" strokeWidth={1} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Users className="h-4 w-4" />{L("ผู้ใช้ใช้งานสูงสุด", "Top users by cost")}
              </h2>
              <Table
                head={[L("ผู้ใช้", "User"), L("งาน", "Runs"), L("โทเค็น", "Tokens"), L("ต้นทุน", "Cost")]}
                rows={data.topUsers.map((u) => [u.name, u.runs.toString(), fmtTokens(u.tokens), fmtCost(u.cost)])}
              />
            </section>
            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                {L("เทมเพลตยอดนิยม", "Top templates")}
              </h2>
              <Table
                head={[L("เทมเพลต", "Template"), L("งาน", "Runs"), L("เฉลี่ย tok", "Avg tok"), L("ต้นทุน", "Cost"), L("fail %", "Fail %")]}
                rows={data.topTemplates.map((t) => [
                  t.id,
                  t.runs.toString(),
                  fmtTokens(t.avgTokens),
                  fmtCost(t.cost),
                  `${(t.failRate * 100).toFixed(1)}%`,
                ])}
              />
            </section>
          </div>

          {data.worstTemplates.length > 0 && (
            <section className="mt-6 rounded-lg border border-amber-500/40 bg-amber-500/5 p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                {L("เทมเพลตที่ fail บ่อย", "Templates with most failures")}
              </h2>
              <Table
                head={[L("เทมเพลต", "Template"), L("fail", "Fails"), L("งาน", "Runs"), L("fail %", "Fail %")]}
                rows={data.worstTemplates.map((t) => [
                  t.id,
                  t.fails.toString(),
                  t.runs.toString(),
                  `${(t.failRate * 100).toFixed(1)}%`,
                ])}
              />
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-xs text-muted-foreground">—</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
        <tr>{head.map((h, i) => <th key={i} className="px-2 py-2 text-left font-medium">{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-border last:border-0">
            {r.map((c, j) => (
              <td key={j} className={`px-2 py-2 ${j === 0 ? "text-foreground" : "text-muted-foreground font-mono text-xs"}`}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
