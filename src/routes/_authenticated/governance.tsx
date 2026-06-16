import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/lib/i18n";
import { listAuditLogs } from "@/lib/ai.functions";
import { ShieldCheck, Lock, FileSearch, Eye } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/governance")({
  head: () => ({ meta: [{ title: "ธรรมาภิบาล · RathCoWork" }] }),
  component: GovernancePage,
});

function GovernancePage() {
  const { t, lang } = useI18n();
  const fetchLogs = useServerFn(listAuditLogs);
  const { data, isLoading } = useQuery({ queryKey: ["audit-logs"], queryFn: () => fetchLogs() });

  const POLICIES = [
    { icon: Lock, th: "ข้อมูลทั้งหมดเข้ารหัสและจัดเก็บภายในประเทศ", en: "All data encrypted and stored in-country" },
    { icon: Eye, th: "ทุกการเรียกใช้ AI มีการบันทึก audit log", en: "Every AI call recorded in audit log" },
    { icon: FileSearch, th: "การเข้าถึงข้อมูลอยู่ภายใต้นโยบาย RLS รายบุคคล", en: "Per-user access enforced by row-level security" },
    { icon: ShieldCheck, th: "PII (เลขบัตร เบอร์ อีเมล) ถูกปกปิดก่อนส่ง AI", en: "PII (ID, phone, email) redacted before AI calls" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-xl font-semibold text-foreground">{t("governanceTitle")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("governanceDesc")}</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {POLICIES.map((p) => (
          <div key={p.en} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
              <p.icon className="h-4 w-4" />
            </div>
            <p className="pt-1 text-sm text-foreground">{lang === "th" ? p.th : p.en}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-foreground">{t("auditLogTitle")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {lang === "th"
            ? "ผู้ใช้ทั่วไปเห็นเฉพาะบันทึกของตน ผู้ดูแลระบบเห็นทั้งหมด"
            : "Regular users see only their own entries; admins see all."}
        </p>

        <div className="mt-3 overflow-hidden rounded-lg border border-border">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : !data?.logs.length ? (
            <p className="p-12 text-center text-sm text-muted-foreground">{t("auditLogEmpty")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{lang === "th" ? "เวลา" : "When"}</th>
                  <th className="px-3 py-2 text-left font-medium">{lang === "th" ? "การกระทำ" : "Action"}</th>
                  <th className="px-3 py-2 text-left font-medium">{lang === "th" ? "ทรัพยากร" : "Resource"}</th>
                  <th className="px-3 py-2 text-left font-medium">{lang === "th" ? "รายละเอียด" : "Details"}</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString(lang === "th" ? "th-TH" : "en-US")}
                    </td>
                    <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{l.action}</Badge></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground font-mono">{l.resource ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-md truncate">
                      {l.metadata && Object.keys(l.metadata as object).length > 0
                        ? JSON.stringify(l.metadata)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
