import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getRun } from "@/lib/ai.functions";
import { TEMPLATES_BY_ID } from "@/lib/templates";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Copy, FileDown, FileText } from "lucide-react";
import { toast } from "sonner";
import { exportRunToPdf, exportRunToDocx } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/history/$runId")({
  head: () => ({ meta: [{ title: "รายละเอียดงาน · TaskRath" }] }),
  component: RunDetail,
});

function RunDetail() {
  const { runId } = Route.useParams();
  const { t, lang } = useI18n();
  const fetch = useServerFn(getRun);
  const { data, isLoading } = useQuery({
    queryKey: ["run", runId],
    queryFn: () => fetch({ data: { id: runId } }),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!data?.run) return <p className="p-8 text-sm text-muted-foreground">{t("empty")}</p>;

  const run = data.run;
  const tpl = run.template_id ? TEMPLATES_BY_ID[run.template_id] : null;
  const inputObj = (run.input ?? {}) as Record<string, string>;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link to="/history" className="mb-5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" />{t("back")}
      </Link>
      <h1 className="text-xl font-semibold text-foreground">
        {tpl ? (lang === "th" ? tpl.titleTh : tpl.titleEn) : (lang === "th" ? "สั่งงานอิสระ" : "Freeform")}
      </h1>
      <p className="mt-1 text-xs text-muted-foreground">
        {new Date(run.created_at).toLocaleString(lang === "th" ? "th-TH" : "en-US")}
      </p>

      <div className="mt-6 rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold">{lang === "th" ? "ข้อมูลที่ป้อน" : "Inputs"}</h2>
        <dl className="space-y-2 text-sm">
          {Object.entries(inputObj).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-foreground">{String(v)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{t("result")}</h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(run.output ?? ""); toast.success(t("copied")); }}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />{t("copy")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => exportRunToPdf(run, tpl ? (lang === "th" ? tpl.titleTh : tpl.titleEn) : "Document")}>
              <FileDown className="mr-1.5 h-3.5 w-3.5" />PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={async () => { await exportRunToDocx(run, tpl ? (lang === "th" ? tpl.titleTh : tpl.titleEn) : "Document"); toast.success("DOCX"); }}>
              <FileText className="mr-1.5 h-3.5 w-3.5" />DOCX
            </Button>
          </div>
        </div>
        <pre className="whitespace-pre-wrap text-sm text-foreground">{run.output}</pre>
      </div>
    </div>
  );
}
