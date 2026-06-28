import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSharedSkills, type SharedSkill } from "@/lib/shared-skills.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SkillIcon } from "@/components/SkillIcon";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Sparkles, Search, Settings2, ArrowRight, Telescope, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/skills/")({
  head: () => ({ meta: [{ title: "Skills · RathCoWork" }] }),
  component: SkillsPage,
});

function SkillsPage() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const fetchSkills = useServerFn(listSharedSkills);
  const { data, isLoading } = useQuery({
    queryKey: ["shared-skills"],
    queryFn: () => fetchSkills(),
  });

  const skills: SharedSkill[] = data?.skills ?? [];
  const canManage = data?.canManage ?? false;


  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("__all__");
  const [active, setActive] = useState<SharedSkill | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of skills) if (s.category) set.add(s.category);
    return Array.from(set).sort();
  }, [skills]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return skills.filter((s) => {
      if (cat !== "__all__" && s.category !== cat) return false;
      if (!needle) return true;
      return (
        s.name.toLowerCase().includes(needle) ||
        (s.description ?? "").toLowerCase().includes(needle)
      );
    });
  }, [skills, q, cat]);

  const runInTool = (s: SharedSkill, tool: "run" | "research", prompt?: string) => {
    try {
      sessionStorage.setItem(
        `${tool}:prefill`,
        JSON.stringify({ sharedSkillId: s.id, prompt: prompt ?? undefined }),
      );
    } catch { /* ignore */ }
    navigate({ to: tool === "run" ? "/run" : "/research" });
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> {lang === "th" ? "คลัง Skill" : "Skill Library"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === "th"
              ? "Skill ที่ผู้ดูแลสร้างและแชร์ให้สมาชิกเรียกใช้ใน สั่งงาน AI / วิจัยเชิงลึก / แชต"
              : "Skills published by admins — usable from Run / Research / Chat."}
          </p>
        </div>

        {canManage && (
          <Button asChild variant="outline">
            <Link to="/skills/manage"><Settings2 className="h-4 w-4 mr-1.5" />{lang === "th" ? "จัดการ Skill" : "Manage skills"}</Link>
          </Button>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={lang === "th" ? "ค้นหา skill…" : "Search skills…"}
            className="pl-8 h-9"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant={cat === "__all__" ? "default" : "outline"} onClick={() => setCat("__all__")}>
              {lang === "th" ? "ทั้งหมด" : "All"}
            </Button>
            {categories.map((c) => (
              <Button key={c} size="sm" variant={cat === c ? "default" : "outline"} onClick={() => setCat(c)}>
                {c}
              </Button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{lang === "th" ? "กำลังโหลด…" : "Loading…"}</p>
      ) : filtered.length === 0 ? (

        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {skills.length === 0
              ? (lang === "th" ? "ยังไม่มี Skill ที่หน่วยงานแชร์" : "No shared skills yet")
              : (lang === "th" ? "ไม่พบ Skill ที่ตรงกับการค้นหา" : "No matching skills")}
            {canManage && skills.length === 0 && (
              <div className="mt-3">
                <Button asChild size="sm"><Link to="/skills/manage">{lang === "th" ? "สร้าง Skill แรก" : "Create first skill"}</Link></Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s)}
              className="text-left group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <SkillIcon value={s.icon} className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold leading-snug line-clamp-1">{s.name}</h3>
                    {s.category && <p className="text-[11px] text-muted-foreground">{s.category}</p>}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100 text-muted-foreground" />
              </div>
              {s.description && (
                <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{s.description}</p>
              )}
              {(s.conversation_starters?.length ?? 0) > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.conversation_starters.slice(0, 2).map((cs, i) => (
                    <span key={i} className="inline-block max-w-full truncate rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {cs}
                    </span>
                  ))}
                  {s.conversation_starters.length > 2 && (
                    <span className="text-[10px] text-muted-foreground">+{s.conversation_starters.length - 2}</span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <SkillIcon value={active.icon} className="h-3.5 w-3.5" />
                  </span>
                  {active.name}
                </SheetTitle>
                {active.description && <SheetDescription>{active.description}</SheetDescription>}
              </SheetHeader>

              <div className="mt-4 space-y-4">
                {(active.conversation_starters?.length ?? 0) > 0 && (
                  <div>
                    <h4 className="text-xs font-medium uppercase text-muted-foreground mb-1.5">
                      {lang === "th" ? "เริ่มงานด้วยคำสั่งนี้" : "Start with"}
                    </h4>
                    <div className="flex flex-col gap-1.5">
                      {active.conversation_starters.map((cs, i) => (
                        <button
                          key={i}
                          onClick={() => runInTool(active, "run", cs)}
                          className="rounded-md border border-border bg-muted/30 px-3 py-2 text-left text-xs hover:border-primary/40 hover:bg-accent/30"
                        >
                          {cs}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-medium uppercase text-muted-foreground mb-1">
                    {lang === "th" ? "บทบาท (role prompt)" : "Role prompt"}
                  </h4>
                  <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-xs">
                    {active.role_prompt}
                  </pre>
                </div>

                {active.recommended_model && (
                  <div className="text-xs text-muted-foreground">
                    {lang === "th" ? "โมเดลที่แนะนำ" : "Recommended model"}: <code className="text-foreground">{active.recommended_model}</code>
                  </div>
                )}

                {active.example_output && (
                  <div>
                    <h4 className="text-xs font-medium uppercase text-muted-foreground mb-1">
                      {lang === "th" ? "ตัวอย่างผลลัพธ์" : "Sample output"}
                    </h4>
                    <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-xs">
                      {active.example_output}
                    </pre>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2 pt-2">
                  <Button onClick={() => runInTool(active, "run")} className="justify-start">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {lang === "th" ? "ใช้ใน สั่งงาน AI" : "Use in Run"}
                  </Button>
                  <Button onClick={() => runInTool(active, "research")} variant="outline" className="justify-start">
                    <Telescope className="h-4 w-4 mr-2" />
                    {lang === "th" ? "ใช้ในวิจัยเชิงลึก" : "Use in Deep Research"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
