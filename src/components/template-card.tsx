import { Link } from "@tanstack/react-router";
import type { Template } from "@/lib/templates";
import { useI18n } from "@/lib/i18n";

export function TemplateCard({ template }: { template: Template }) {
  const { lang } = useI18n();
  const Icon = template.icon;
  return (
    <Link
      to="/run/$templateId"
      params={{ templateId: template.id }}
      className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-sm"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-primary group-hover:bg-primary/10">
        <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">
          {lang === "th" ? template.titleTh : template.titleEn}
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {lang === "th" ? template.descTh : template.descEn}
        </p>
      </div>
    </Link>
  );
}
