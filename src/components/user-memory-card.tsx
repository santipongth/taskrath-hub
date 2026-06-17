import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyMemory, upsertMemory, deleteMemory, type MemoryEntry } from "@/lib/user-memory.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Brain, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export function UserMemoryCard({ lang }: { lang: "th" | "en" }) {
  const qc = useQueryClient();
  const fetchList = useServerFn(listMyMemory);
  const upsert = useServerFn(upsertMemory);
  const del = useServerFn(deleteMemory);

  const { data, isLoading } = useQuery({
    queryKey: ["user-memory"],
    queryFn: () => fetchList(),
    staleTime: 60_000,
  });
  const entries: MemoryEntry[] = data?.entries ?? [];

  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const onAdd = async () => {
    if (!key.trim() || !value.trim()) return;
    setSaving(true);
    try {
      await upsert({ data: { key: key.trim(), value: value.trim() } });
      setKey(""); setValue("");
      await qc.invalidateQueries({ queryKey: ["user-memory"] });
      toast.success(lang === "th" ? "บันทึกแล้ว" : "Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    try {
      await del({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["user-memory"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">{lang === "th" ? "บริบทส่วนตัว (Memory)" : "Personal Memory"}</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        {lang === "th"
          ? "ข้อมูลที่ AI จะจดจำและนำไปประกอบทุกครั้งที่คุณสั่งงาน เช่น ชื่อ ตำแหน่ง สำนวนที่ใช้บ่อย — เห็นเฉพาะคุณเท่านั้น"
          : "Context the AI recalls in every run — name, role, common phrasing, only visible to you"}
      </p>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">{lang === "th" ? "กำลังโหลด…" : "Loading…"}</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{lang === "th" ? "ยังไม่มีบริบท เพิ่มได้ด้านล่าง" : "No entries yet"}</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start gap-2 rounded-md border border-border bg-background p-2 text-xs">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground">{e.key}</div>
                <div className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{e.value}</div>
              </div>
              <button onClick={() => onDelete(e.id)} className="text-muted-foreground hover:text-destructive" aria-label="delete">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 border-t border-border pt-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{lang === "th" ? "หัวข้อ" : "Key"}</Label>
          <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder={lang === "th" ? "เช่น ตำแหน่ง" : "e.g. role"} maxLength={60} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{lang === "th" ? "เนื้อหา" : "Value"}</Label>
          <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={2} placeholder={lang === "th" ? "เช่น ผู้อำนวยการกองนโยบาย กระทรวง…" : "e.g. Director of Policy Division at…"} maxLength={1000} />
        </div>
        <Button size="sm" onClick={onAdd} disabled={saving || !key.trim() || !value.trim()}>
          <Plus className="mr-1 h-3.5 w-3.5" />{lang === "th" ? "บันทึก" : "Save"}
        </Button>
      </div>
    </div>
  );
}
