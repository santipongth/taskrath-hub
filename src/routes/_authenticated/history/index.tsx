import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listHistory, getRun } from "@/lib/ai.functions";
import { getAgencySettings } from "@/lib/admin.functions";
import { TEMPLATES_BY_ID } from "@/lib/templates";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, FileDown, FileText } from "lucide-react";
import { exportRunToPdf, exportRunToDocx } from "@/lib/export";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/history/")({
  head: () => ({ meta: [{ title: "ประวัติการใช้งาน · TaskRath" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const { t, lang } = useI18n();
  const fetchHistory = useServerFn(listHistory);
  const fetchRun = useServerFn(getRun);
  const fetchAgency = useServerFn(getAgencySettings);
  const { data, isLoading } = useQuery({ queryKey: ["history"], queryFn: () => fetchHistory() });
  const { data: agency } = useQuery({ queryKey: ["agency"], queryFn: () => fetchAgency() });

  async function handleExport(runId: string, title: string, kind: "pdf" | "docx") {
    const res = await fetchRun({ data: { id: runId } });
    if (!res?.run) return;
    if (kind === "pdf") { await exportRunToPdf(res.run, title, agency ?? null); toast.success("PDF"); }
    else { await exportRunToDocx(res.run, title, agency ?? null); toast.success("DOCX"); }
  }

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
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.runs.map((r) => {
                const tpl = r.template_id ? TEMPLATES_BY_ID[r.template_id] : null;
                const title = tpl ? (lang === "th" ? tpl.titleTh : tpl.titleEn) : (lang === "th" ? "สั่งงานอิสระ" : "Freeform");
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link to="/history/$runId" params={{ runId: r.id }} className="font-medium text-foreground hover:text-primary">
                        {title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.title ?? "—"}</td>
                    <td className="px-4 py-3">
                      {r.needs_approval ? <Badge variant="outline">{t("requestApproval")}</Badge> : <Badge variant="secondary">{r.status}</Badge>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString(lang === "th" ? "th-TH" : "en-US")}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleExport(r.id, title, "pdf")}>
                            <FileDown className="mr-2 h-4 w-4" />Export PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport(r.id, title, "docx")}>
                            <FileText className="mr-2 h-4 w-4" />Export DOCX
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
