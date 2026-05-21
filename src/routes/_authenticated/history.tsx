import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listHistory } from "@/lib/ai.functions";
import { TEMPLATES_BY_ID } from "@/lib/templates";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "ประวัติการใช้งาน · TaskRath" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const { t, lang } = useI18n();
  const fetchHistory = useServerFn(listHistory);
  const { data, isLoading } = useQuery({ queryKey: ["history"], queryFn: () => fetchHistory() });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-xl font-semibold text-foreground">{t("historyTitle")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {lang === "th" ? "งานทั้งหมดที่คุณสั่งให้ AI ทำ" : "All your past AI runs"}
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-border">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !data?.runs.length ? (
          <p className="p-12 text-center text-sm text-muted-foreground">{t("historyEmpty")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{lang === "th" ? "เทมเพลต" : "Template"}</th>
                <th className="px-4 py-3 text-left font-medium">{lang === "th" ? "หัวข้อ" : "Title"}</th>
                <th className="px-4 py-3 text-left font-medium">{lang === "th" ? "สถานะ" : "Status"}</th>
                <th className="px-4 py-3 text-left font-medium">{lang === "th" ? "เวลา" : "When"}</th>
              </tr>
            </thead>
            <tbody>
              {data.runs.map((r) => {
                const tpl = r.template_id ? TEMPLATES_BY_ID[r.template_id] : null;
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link to="/history/$runId" params={{ runId: r.id }} className="font-medium text-foreground hover:text-primary">
                        {tpl ? (lang === "th" ? tpl.titleTh : tpl.titleEn) : (lang === "th" ? "สั่งงานอิสระ" : "Freeform")}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.title ?? "—"}</td>
                    <td className="px-4 py-3">
                      {r.needs_approval ? <Badge variant="outline">{t("requestApproval")}</Badge> : <Badge variant="secondary">{r.status}</Badge>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString(lang === "th" ? "th-TH" : "en-US")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
