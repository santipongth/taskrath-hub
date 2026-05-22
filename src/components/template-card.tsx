import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star } from "lucide-react";
import type { Template } from "@/lib/templates";
import { useI18n } from "@/lib/i18n";
import { toggleFavorite } from "@/lib/favorites.functions";
import { cn } from "@/lib/utils";

export function TemplateCard({ template, pinned = false }: { template: Template; pinned?: boolean }) {
  const { lang } = useI18n();
  const Icon = template.icon;
  const qc = useQueryClient();
  const toggle = useServerFn(toggleFavorite);
  const mutation = useMutation({
    mutationFn: () => toggle({ data: { templateId: template.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });

  return (
    <div className="group relative">
      <Link
        to="/run/$templateId"
        params={{ templateId: template.id }}
        className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-sm"
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
      <button
        type="button"
        aria-label={pinned ? "Unpin" : "Pin"}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); mutation.mutate(); }}
        disabled={mutation.isPending}
        className={cn(
          "absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
          pinned ? "text-amber-500" : "text-muted-foreground/40 opacity-0 hover:text-amber-500 group-hover:opacity-100",
        )}
      >
        <Star className="h-4 w-4" fill={pinned ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
