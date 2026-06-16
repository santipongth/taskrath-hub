import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  listAllCustomTemplates, upsertCustomTemplate, deleteCustomTemplate,
  type CustomTemplateInput, type CustomTemplateField,
} from "@/lib/custom-templates.functions";
import { ICON_OPTIONS, getTemplateIcon } from "@/lib/template-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/templates")({
  head: () => ({ meta: [{ title: "เทมเพลตของหน่วยงาน · RathCoWork Admin" }] }),
  component: AdminTemplatesPage,
});

const CATEGORIES = ["meeting", "letter", "analysis", "legal", "citizen"] as const;

const EMPTY: CustomTemplateInput = {
  slug: "",
  title_th: "",
  title_en: "",
  desc_th: "",
  desc_en: "",
  category: "letter",
  icon: "FileText",
  system_prompt_th: "",
  fields: [],
  is_active: true,
};

function AdminTemplatesPage() {
  const { lang } = useI18n();
  const L = (th: string, en: string) => (lang === "th" ? th : en);
  const qc = useQueryClient();
  const list = useServerFn(listAllCustomTemplates);
  const save = useServerFn(upsertCustomTemplate);
  const del = useServerFn(deleteCustomTemplate);
  const { data, isLoading } = useQuery({ queryKey: ["custom-templates-admin"], queryFn: () => list() });

  const [editing, setEditing] = useState<{ id?: string; data: CustomTemplateInput } | null>(null);

  const saveMut = useMutation({
    mutationFn: (v: { id?: string; data: CustomTemplateInput }) => save({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-templates-admin"] });
      qc.invalidateQueries({ queryKey: ["custom-templates"] });
      toast.success(L("บันทึกแล้ว", "Saved"));
      setEditing(null);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-templates-admin"] });
      qc.invalidateQueries({ queryKey: ["custom-templates"] });
      toast.success(L("ลบแล้ว", "Deleted"));
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{L("เทมเพลตของหน่วยงาน", "Custom Templates")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {L("สร้างเทมเพลตเฉพาะของหน่วยงานเพิ่มจากเทมเพลตมาตรฐาน", "Add templates beyond the built-in library")}
          </p>
        </div>
        <Button onClick={() => setEditing({ data: { ...EMPTY } })}>
          <Plus className="mr-1.5 h-4 w-4" />{L("เพิ่มเทมเพลต", "Add template")}
        </Button>
      </div>

      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="rounded-lg border border-border bg-card">
          {(data?.templates ?? []).length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">{L("ยังไม่มีเทมเพลต", "No templates yet")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {(data?.templates ?? []).map((t) => {
                const Icon = getTemplateIcon(t.icon);
                return (
                  <li key={t.id} className="flex items-center gap-3 p-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium truncate">{t.title_th}</h3>
                        {!t.is_active && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{L("ปิดใช้งาน", "inactive")}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        <code className="rounded bg-muted px-1 py-0.5">{t.slug}</code> · {t.category} · {(t.fields as unknown[])?.length ?? 0} fields
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setEditing({
                      id: t.id,
                      data: {
                        slug: t.slug, title_th: t.title_th, title_en: t.title_en, desc_th: t.desc_th, desc_en: t.desc_en,
                        category: t.category as CustomTemplateInput["category"], icon: t.icon,
                        system_prompt_th: t.system_prompt_th,
                        fields: (t.fields as CustomTemplateField[]) ?? [],
                        is_active: t.is_active,
                      },
                    })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => {
                      if (confirm(L("ลบเทมเพลตนี้?", "Delete this template?"))) delMut.mutate(t.id);
                    }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? L("แก้ไขเทมเพลต", "Edit template") : L("เพิ่มเทมเพลต", "Add template")}</DialogTitle>
          </DialogHeader>
          {editing && <TemplateForm value={editing.data} onChange={(d) => setEditing({ ...editing, data: d })} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}><X className="mr-1.5 h-4 w-4" />{L("ยกเลิก", "Cancel")}</Button>
            <Button onClick={() => editing && saveMut.mutate(editing)} disabled={saveMut.isPending}>
              <Save className="mr-1.5 h-4 w-4" />{saveMut.isPending ? "…" : L("บันทึก", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateForm({ value, onChange }: { value: CustomTemplateInput; onChange: (v: CustomTemplateInput) => void }) {
  const { lang } = useI18n();
  const L = (th: string, en: string) => (lang === "th" ? th : en);
  const set = <K extends keyof CustomTemplateInput>(k: K, v: CustomTemplateInput[K]) => onChange({ ...value, [k]: v });

  const addField = () => set("fields", [...value.fields, { name: `field${value.fields.length + 1}`, labelTh: "", labelEn: "", type: "text", required: false }]);
  const updateField = (i: number, patch: Partial<CustomTemplateField>) => set("fields", value.fields.map((f, j) => j === i ? { ...f, ...patch } : f));
  const removeField = (i: number) => set("fields", value.fields.filter((_, j) => j !== i));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Slug (a-z, 0-9, -)</Label>
          <Input value={value.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} placeholder="my-template" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{L("หมวดหมู่", "Category")}</Label>
          <Select value={value.category} onValueChange={(v) => set("category", v as CustomTemplateInput["category"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{L("ชื่อ (ไทย)", "Title (TH)")}</Label>
          <Input value={value.title_th} onChange={(e) => set("title_th", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{L("ชื่อ (อังกฤษ)", "Title (EN)")}</Label>
          <Input value={value.title_en} onChange={(e) => set("title_en", e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{L("คำอธิบาย (ไทย)", "Description (TH)")}</Label>
        <Input value={value.desc_th} onChange={(e) => set("desc_th", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Icon</Label>
          <Select value={value.icon} onValueChange={(v) => set("icon", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ICON_OPTIONS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Label className="text-xs">{L("ใช้งาน", "Active")}</Label>
          <Switch checked={value.is_active} onCheckedChange={(v) => set("is_active", v)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{L("System prompt (ไทย)", "System prompt (TH)")}</Label>
        <Textarea rows={5} value={value.system_prompt_th} onChange={(e) => set("system_prompt_th", e.target.value)} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs">{L("ช่องกรอกข้อมูล", "Input fields")}</Label>
          <Button size="sm" variant="ghost" onClick={addField}><Plus className="mr-1 h-3 w-3" />{L("เพิ่ม", "Add")}</Button>
        </div>
        <div className="space-y-2">
          {value.fields.map((f, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 rounded-md border border-border p-2">
              <Input className="col-span-3" placeholder="name" value={f.name} onChange={(e) => updateField(i, { name: e.target.value })} />
              <Input className="col-span-4" placeholder={L("ป้ายภาษาไทย", "Thai label")} value={f.labelTh} onChange={(e) => updateField(i, { labelTh: e.target.value })} />
              <Select value={f.type} onValueChange={(v) => updateField(i, { type: v as "text" | "textarea" })}>
                <SelectTrigger className="col-span-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">text</SelectItem>
                  <SelectItem value="textarea">textarea</SelectItem>
                </SelectContent>
              </Select>
              <label className="col-span-2 flex items-center gap-1 text-xs">
                <input type="checkbox" checked={f.required ?? false} onChange={(e) => updateField(i, { required: e.target.checked })} />
                required
              </label>
              <Button variant="ghost" size="sm" onClick={() => removeField(i)} className="col-span-1">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
