import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FolderKanban, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { listMyProjects, upsertProject } from "@/lib/user-projects.functions";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({ meta: [{ title: "Notebooks · RathCoWork" }] }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listMyProjects);
  const upsertFn = useServerFn(upsertProject);

  const { data, isLoading } = useQuery({
    queryKey: ["my-projects"],
    queryFn: () => listFn(),
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [context, setContext] = useState("");

  const create = useMutation({
    mutationFn: () => upsertFn({ data: { name: name.trim(), context: context.trim() || null } }),
    onSuccess: async (r) => {
      toast.success(lang === "th" ? "สร้าง Notebook แล้ว" : "Notebook created");
      setOpen(false); setName(""); setContext("");
      await qc.invalidateQueries({ queryKey: ["my-projects"] });
      navigate({ to: "/projects/$projectId", params: { projectId: r.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const projects = data?.projects ?? [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <FolderKanban className="h-5 w-5 text-primary" />
            {lang === "th" ? "Notebooks (โปรเจกต์ของฉัน)" : "Notebooks"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {lang === "th"
              ? "รวมแหล่งข้อมูล โน้ต และผลการวิจัยของแต่ละหัวข้อไว้ในที่เดียว"
              : "Group sources, notes, and research per topic"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1.5 h-4 w-4" />{lang === "th" ? "สร้างใหม่" : "New"}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{lang === "th" ? "สร้าง Notebook" : "Create notebook"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={lang === "th" ? "ชื่อ เช่น MOU มหาวิทยาลัย X ปี 2026" : "Name"}
              />
              <Textarea
                rows={4}
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder={lang === "th" ? "บริบทสั้น ๆ ที่อยากให้ AI รู้เกี่ยวกับโปรเจกต์นี้ (ไม่บังคับ)" : "Optional context"}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>{lang === "th" ? "ยกเลิก" : "Cancel"}</Button>
              <Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>
                {create.isPending ? "…" : lang === "th" ? "สร้าง" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">{lang === "th" ? "กำลังโหลด…" : "Loading…"}</div>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {lang === "th" ? "ยังไม่มี Notebook — กด \"สร้างใหม่\" เพื่อเริ่ม" : "No notebooks yet"}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              to="/projects/$projectId"
              params={{ projectId: p.id }}
              className="group rounded-lg border border-border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-2 text-sm font-semibold text-foreground">{p.name}</h3>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
              </div>
              {p.context && (
                <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{p.context}</p>
              )}
              {p.archived && (
                <span className="mt-2 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {lang === "th" ? "เก็บถาวร" : "Archived"}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
