import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { ShieldCheck, Lock, FileSearch, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/governance")({
  head: () => ({ meta: [{ title: "ธรรมาภิบาล · TaskRath" }] }),
  component: GovernancePage,
});

function GovernancePage() {
  const { t, lang } = useI18n();
  const POLICIES = [
    { icon: Lock, th: "ข้อมูลทั้งหมดเข้ารหัสและจัดเก็บภายในประเทศ", en: "All data encrypted and stored in-country" },
    { icon: Eye, th: "ทุกการเรียกใช้ AI มีการบันทึก audit log", en: "Every AI call recorded in audit log" },
    { icon: FileSearch, th: "การเข้าถึงข้อมูลอยู่ภายใต้นโยบาย RLS รายบุคคล", en: "Per-user access enforced by row-level security" },
    { icon: ShieldCheck, th: "ผู้ดูแลระบบสามารถตรวจสอบและกำหนดสิทธิ์", en: "Admins can audit and assign roles" },
  ];

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-xl font-semibold text-foreground">{t("governanceTitle")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("governanceDesc")}</p>

      <div className="mt-6 space-y-3">
        {POLICIES.map((p) => (
          <div key={p.en} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
              <p.icon className="h-4 w-4" />
            </div>
            <p className="pt-1 text-sm text-foreground">{lang === "th" ? p.th : p.en}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-foreground">
          {lang === "th" ? "บันทึกการใช้งาน (Audit Log)" : "Audit Log"}
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          {lang === "th"
            ? "เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถเข้าถึงบันทึกฉบับเต็ม"
            : "Only administrators can view the full audit log."}
        </p>
      </div>
    </div>
  );
}
