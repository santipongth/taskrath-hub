import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPendingApprovals, decideApproval } from "@/lib/ai.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({ meta: [{ title: "อนุมัติ · TaskRath" }] }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const list = useServerFn(listPendingApprovals);
  const decide = useServerFn(decideApproval);
  const { data, isLoading } = useQuery({ queryKey: ["approvals"], queryFn: () => list() });

  const onDecide = async (approvalId: string, decision: "approved" | "rejected") => {
    try {
      await decide({ data: { approvalId, decision } });
      toast.success(decision === "approved" ? t("approve") : t("reject"));
      qc.invalidateQueries({ queryKey: ["approvals"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-xl font-semibold text-foreground">{t("approvalsTitle")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {lang === "th" ? "รายการที่รอผู้บังคับบัญชาอนุมัติ" : "Items awaiting supervisor approval"}
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-border">
        {isLoading ? (
          <div className="space-y-2 p-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : !data?.approvals.length ? (
          <p className="p-12 text-center text-sm text-muted-foreground">{t("approvalsEmpty")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{lang === "th" ? "ผู้ขอ" : "Requester"}</th>
                <th className="px-4 py-3 text-left font-medium">{lang === "th" ? "หมายเหตุ" : "Note"}</th>
                <th className="px-4 py-3 text-left font-medium">{lang === "th" ? "สถานะ" : "Status"}</th>
                <th className="px-4 py-3 text-left font-medium">{lang === "th" ? "การกระทำ" : "Action"}</th>
              </tr>
            </thead>
            <tbody>
              {data.approvals.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-xs text-muted-foreground">{a.requester_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3">{a.note ?? "—"}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{a.status}</Badge></td>
                  <td className="px-4 py-3">
                    {a.status === "pending" ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => onDecide(a.id, "approved")}>{t("approve")}</Button>
                        <Button size="sm" variant="outline" onClick={() => onDecide(a.id, "rejected")}>{t("reject")}</Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {a.decided_at ? new Date(a.decided_at).toLocaleDateString() : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
