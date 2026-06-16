import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listDeptProviders,
  upsertDeptProvider,
  deleteDeptProvider,
  testDeptProvider,
  listDeptRoutes,
  upsertDeptRoute,
  deleteDeptRoute,
  type DeptProvider,
  type DeptRoute,
} from "@/lib/dept-providers.functions";
import { getDeptAdminInfo } from "@/lib/dept-agents.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, Trash2, Zap, Cpu, Route as RouteIcon, ArrowUp, ArrowDown, FlaskConical } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/agents/manage/providers")({
  head: () => ({ meta: [{ title: "โมเดล AI ของหน่วยงาน · RathCoWork" }] }),
  component: ProvidersPage,
});

type PresetKind = "lovable" | "openai_compatible" | "typhoon" | "hiclaw";
type Preset = {
  label: string;
  kind: PresetKind;
  base_url: string;
  model_id: string;
  secret_name: string;
  hint: string;
};

const PRESETS: Preset[] = [
  { label: "Lovable AI Gateway", kind: "lovable", base_url: "", model_id: "google/gemini-2.5-flash", secret_name: "LOVABLE_API_KEY", hint: "ค่าตั้งต้นของระบบ ไม่ต้องตั้ง secret เพิ่ม" },
  { label: "Typhoon (SCB10X)", kind: "typhoon", base_url: "https://api.opentyphoon.ai/v1", model_id: "typhoon-v2-70b-instruct", secret_name: "TYPHOON_API_KEY", hint: "สมัครได้ที่ opentyphoon.ai" },
  { label: "OpenThaiGPT (vLLM/Ollama)", kind: "openai_compatible", base_url: "http://localhost:11434/v1", model_id: "openthaigpt-1.5-7b-instruct", secret_name: "OPENTHAIGPT_API_KEY", hint: "Endpoint ภายในหน่วยงาน — รองรับ OpenAI-compatible" },
  { label: "Pathumma (NECTEC)", kind: "openai_compatible", base_url: "", model_id: "pathumma-llm-text-1.0.0", secret_name: "PATHUMMA_API_KEY", hint: "ตั้งค่า base_url ตาม endpoint ภายในที่ใช้งาน" },
  { label: "Qwen via OpenRouter", kind: "openai_compatible", base_url: "https://openrouter.ai/api/v1", model_id: "qwen/qwen-2.5-72b-instruct", secret_name: "OPENROUTER_API_KEY", hint: "สมัครคีย์ที่ openrouter.ai" },
  { label: "DeepSeek API", kind: "openai_compatible", base_url: "https://api.deepseek.com/v1", model_id: "deepseek-chat", secret_name: "DEEPSEEK_API_KEY", hint: "สมัครคีย์ที่ platform.deepseek.com" },
  { label: "HiClaw (สำนัก ก.พ.)", kind: "hiclaw", base_url: "", model_id: "default", secret_name: "HICLAW_API_KEY", hint: "ใช้ค่าจากตัวแปร HICLAW_API_URL/HICLAW_API_KEY ที่ตั้งใน Secrets" },
];

function ProvidersPage() {
  const navigate = useNavigate();
  const info = useServerFn(getDeptAdminInfo);
  const [allowed, setAllowed] = useState<null | boolean>(null);
  const [dept, setDept] = useState<string | null>(null);

  useEffect(() => {
    info({}).then((i) => {
      setAllowed(i.canManage);
      setDept(i.department);
      if (!i.canManage) toast.error("ต้องเป็น admin ของหน่วยงานจึงจะเข้าหน้านี้ได้");
    });
  }, [info]);

  if (allowed === null) return <div className="p-6 text-sm text-muted-foreground">กำลังตรวจสอบสิทธิ์…</div>;
  if (!allowed) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-lg font-semibold">ไม่อนุญาต</h1>
        <p className="mt-2 text-sm text-muted-foreground">{dept ? `หน่วยงาน: ${dept}` : "ยังไม่ได้กำหนดหน่วยงาน"}</p>
        <Button asChild className="mt-4" variant="outline" size="sm"><Link to="/agents"><ArrowLeft className="h-4 w-4 mr-1" /> กลับ</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">โมเดล AI ของหน่วยงาน</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            หน่วยงาน <span className="font-medium text-foreground">{dept}</span> · เลือกโมเดลไทย/อธิปไตยหรือบริการพาณิชย์ก็ได้ พร้อมตั้ง fallback chain
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/agents/manage" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
        </Button>
      </div>

      <Tabs defaultValue="providers" className="mt-6">
        <TabsList>
          <TabsTrigger value="providers"><Cpu className="h-4 w-4 mr-1" /> Providers</TabsTrigger>
          <TabsTrigger value="routes"><RouteIcon className="h-4 w-4 mr-1" /> Routing</TabsTrigger>
        </TabsList>
        <TabsContent value="providers" className="mt-4"><ProvidersTab /></TabsContent>
        <TabsContent value="routes" className="mt-4"><RoutesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Providers Tab ──────────────────────────────────────────
function ProvidersTab() {
  const list = useServerFn(listDeptProviders);
  const upsert = useServerFn(upsertDeptProvider);
  const del = useServerFn(deleteDeptProvider);
  const test = useServerFn(testDeptProvider);
  const [providers, setProviders] = useState<DeptProvider[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DeptProvider | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const reload = () => list({}).then((r) => setProviders(r.providers));
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const onTest = async (id: string) => {
    setTesting(id);
    try {
      const r = await test({ data: { id } });
      if (r.ok) toast.success(`เชื่อมต่อสำเร็จ · ${r.latency_ms}ms · "${(r.sample ?? "").slice(0, 60)}"`);
      else toast.error(`เชื่อมต่อล้มเหลว: ${r.error}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setTesting(null);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("ลบ provider นี้? routes ที่อ้างถึงจะใช้งานไม่ได้")) return;
    try {
      await del({ data: { id } });
      toast.success("ลบแล้ว");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> เพิ่ม Provider
        </Button>
      </div>
      <div className="space-y-2">
        {providers.length === 0 && (
          <p className="text-sm text-muted-foreground">ยังไม่ได้ตั้งค่า provider — เริ่มจากเทมเพลตได้เลย (เช่น Typhoon, OpenThaiGPT)</p>
        )}
        {providers.map((p) => (
          <div key={p.id} className="rounded-md border border-border bg-card p-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold">{p.name}</h3>
                <Badge variant="outline" className="text-[10px]">{p.kind}</Badge>
                {!p.enabled && <Badge variant="secondary" className="text-[10px]">ปิดใช้งาน</Badge>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground font-mono break-all">{p.model_id} {p.base_url ? `· ${p.base_url}` : ""}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                secret: <code>{p.api_key_secret_name ?? "—"}</code> · ราคา in/out: {p.price_in_per_mtok}/{p.price_out_per_mtok} USD/Mtok
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="sm" disabled={testing === p.id} onClick={() => onTest(p.id)}>
                <FlaskConical className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(p); setOpen(true); }}>แก้</Button>
              <Button variant="ghost" size="sm" onClick={() => onDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>

      <ProviderDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        initial={editing}
        onSave={async (payload) => {
          try {
            await upsert({ data: payload });
            toast.success("บันทึกแล้ว");
            setOpen(false);
            setEditing(null);
            await reload();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error");
          }
        }}
      />
    </>
  );
}

function ProviderDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: DeptProvider | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSave: (p: any) => Promise<void>;
}) {
  const { open, onOpenChange, initial, onSave } = props;
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PresetKind>("typhoon");
  const [baseUrl, setBaseUrl] = useState("");
  const [modelId, setModelId] = useState("");
  const [secretName, setSecretName] = useState("");
  const [priceIn, setPriceIn] = useState("0");
  const [priceOut, setPriceOut] = useState("0");
  const [enabled, setEnabled] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setKind(initial.kind);
      setBaseUrl(initial.base_url ?? "");
      setModelId(initial.model_id);
      setSecretName(initial.api_key_secret_name ?? "");
      setPriceIn(String(initial.price_in_per_mtok));
      setPriceOut(String(initial.price_out_per_mtok));
      setEnabled(initial.enabled);
      setSortOrder(String(initial.sort_order ?? 0));
    } else {
      setName(""); setKind("typhoon"); setBaseUrl("https://api.opentyphoon.ai/v1");
      setModelId(""); setSecretName(""); setPriceIn("0"); setPriceOut("0");
      setEnabled(true); setSortOrder("0");
    }
  }, [initial, open]);

  const applyPreset = (p: Preset) => {
    setName((cur) => cur || p.label);
    setKind(p.kind);
    setBaseUrl(p.base_url);
    setModelId(p.model_id);
    setSecretName(p.secret_name);
    toast.info(p.hint);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{initial ? "แก้ไข Provider" : "เพิ่ม Provider"}</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          {!initial && (
            <div>
              <Label className="text-xs">เทมเพลตเริ่มต้น</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <Button key={p.label} type="button" size="sm" variant="outline" onClick={() => applyPreset(p)}>
                    <Zap className="h-3 w-3 mr-1" /> {p.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div>
            <Label>ชื่อแสดง</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น Typhoon Production" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>ประเภท</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as PresetKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lovable">Lovable AI Gateway</SelectItem>
                  <SelectItem value="typhoon">Typhoon (SCB10X)</SelectItem>
                  <SelectItem value="openai_compatible">OpenAI-compatible</SelectItem>
                  <SelectItem value="hiclaw">HiClaw (legacy)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Model ID</Label>
              <Input value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder="เช่น typhoon-v2-70b-instruct" />
            </div>
          </div>
          {kind !== "lovable" && (
            <div>
              <Label>Base URL</Label>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.opentyphoon.ai/v1" />
              <p className="mt-1 text-[11px] text-muted-foreground">ต้องเป็น https:// (อนุญาต http://localhost สำหรับ dev)</p>
            </div>
          )}
          <div>
            <Label>ชื่อ Secret ของ API key</Label>
            <Input value={secretName} onChange={(e) => setSecretName(e.target.value.toUpperCase())} placeholder="TYPHOON_API_KEY" />
            <p className="mt-1 text-[11px] text-muted-foreground">
              ระบบจะอ่านค่าจาก Lovable Cloud Secrets ตามชื่อนี้ — ถ้ายังไม่มี ให้แจ้งผู้ดูแลระบบเพิ่ม secret ก่อน
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">ราคา in (USD/Mtok)</Label>
              <Input type="number" step="0.01" value={priceIn} onChange={(e) => setPriceIn(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">ราคา out (USD/Mtok)</Label>
              <Input type="number" step="0.01" value={priceOut} onChange={(e) => setPriceOut(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Sort</Label>
              <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={enabled} onCheckedChange={setEnabled} /> เปิดใช้งาน
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button
            onClick={() =>
              onSave({
                id: initial?.id,
                name: name.trim(),
                kind,
                base_url: kind === "lovable" ? null : baseUrl.trim() || null,
                model_id: modelId.trim(),
                api_key_secret_name: secretName.trim() || null,
                price_in_per_mtok: Number(priceIn) || 0,
                price_out_per_mtok: Number(priceOut) || 0,
                enabled,
                sort_order: Number(sortOrder) || 0,
              })
            }
          >
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Routes Tab ─────────────────────────────────────────────
type ChainStep = { provider_id: string; on_error?: Array<"429" | "5xx" | "4xx" | "timeout" | "any"> };

function RoutesTab() {
  const listP = useServerFn(listDeptProviders);
  const listR = useServerFn(listDeptRoutes);
  const upsertR = useServerFn(upsertDeptRoute);
  const delR = useServerFn(deleteDeptRoute);
  const [providers, setProviders] = useState<DeptProvider[]>([]);
  const [routes, setRoutes] = useState<DeptRoute[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DeptRoute | null>(null);

  const reload = async () => {
    const [p, r] = await Promise.all([listP({}), listR({})]);
    setProviders(p.providers);
    setRoutes(r.routes);
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const onDel = async (id: string) => {
    if (!confirm("ลบ route นี้?")) return;
    await delR({ data: { id } }); toast.success("ลบแล้ว"); await reload();
  };

  const providerName = (id: string) => providers.find((p) => p.id === id)?.name ?? "(ลบแล้ว)";

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button size="sm" disabled={providers.length === 0} onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> เพิ่ม Route
        </Button>
      </div>
      {providers.length === 0 && (
        <p className="text-sm text-muted-foreground mb-3">ต้องเพิ่ม Provider ก่อนจึงจะสร้าง Route ได้</p>
      )}
      <div className="space-y-2">
        {routes.map((r) => (
          <div key={r.id} className="rounded-md border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{r.name}</h3>
                {r.is_default && <Badge className="text-[10px]">default</Badge>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setOpen(true); }}>แก้</Button>
                <Button variant="ghost" size="sm" onClick={() => onDel(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
            <ol className="mt-2 text-xs text-muted-foreground space-y-0.5">
              {(r.chain ?? []).map((step, i) => (
                <li key={i}>
                  <span className="inline-block w-5 text-foreground/60">#{i + 1}</span>
                  <span className="text-foreground">{providerName(step.provider_id)}</span>
                  {step.on_error && step.on_error.length > 0 && (
                    <span className="ml-2">— fallback บน: {step.on_error.join(", ")}</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        ))}
        {routes.length === 0 && providers.length > 0 && (
          <p className="text-sm text-muted-foreground">ยังไม่มี route — สร้าง chain แรกเพื่อให้ agent/skill เรียกใช้ได้</p>
        )}
      </div>

      <RouteDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        providers={providers}
        initial={editing}
        onSave={async (payload) => {
          try {
            await upsertR({ data: payload });
            toast.success("บันทึกแล้ว");
            setOpen(false); setEditing(null);
            await reload();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error");
          }
        }}
      />
    </>
  );
}

function RouteDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  providers: DeptProvider[];
  initial: DeptRoute | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSave: (p: any) => Promise<void>;
}) {
  const { open, onOpenChange, providers, initial, onSave } = props;
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [chain, setChain] = useState<ChainStep[]>([]);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setIsDefault(initial.is_default);
      setChain((initial.chain ?? []) as ChainStep[]);
    } else {
      setName("Default");
      setIsDefault(false);
      setChain(providers.length > 0 ? [{ provider_id: providers[0].id, on_error: ["any"] }] : []);
    }
  }, [initial, open, providers]);

  const addStep = () => {
    if (providers.length === 0) return;
    setChain((c) => [...c, { provider_id: providers[0].id, on_error: ["any"] }]);
  };
  const move = (i: number, dir: -1 | 1) => {
    setChain((c) => {
      const next = [...c]; const j = i + dir;
      if (j < 0 || j >= next.length) return c;
      [next[i], next[j]] = [next[j], next[i]]; return next;
    });
  };
  const remove = (i: number) => setChain((c) => c.filter((_, idx) => idx !== i));
  const updateStep = (i: number, patch: Partial<ChainStep>) =>
    setChain((c) => c.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const toggleErr = (i: number, code: "429" | "5xx" | "4xx" | "timeout" | "any") => {
    setChain((c) => c.map((s, idx) => {
      if (idx !== i) return s;
      const set = new Set(s.on_error ?? []);
      if (set.has(code)) set.delete(code); else set.add(code);
      return { ...s, on_error: Array.from(set) as ChainStep["on_error"] };
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{initial ? "แก้ไข Route" : "สร้าง Route"}</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <Label>ชื่อ</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น Sovereign-first" />
            </div>
            <label className="flex items-center gap-2 text-sm pb-2">
              <Switch checked={isDefault} onCheckedChange={setIsDefault} /> ตั้งเป็น default
            </label>
          </div>
          <div className="border rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">ลำดับ provider (จะลองจากบนลงล่าง)</span>
              <Button size="sm" variant="outline" onClick={addStep}>เพิ่มขั้น</Button>
            </div>
            {chain.map((step, i) => (
              <div key={i} className="rounded border p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6">#{i + 1}</span>
                  <Select value={step.provider_id} onValueChange={(v) => updateStep(i, { provider_id: v })}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {providers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.kind})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
                <div className="flex flex-wrap gap-3 pl-8 text-xs">
                  <span className="text-muted-foreground">ลองตัวถัดไปเมื่อเจอ:</span>
                  {(["429", "5xx", "4xx", "timeout", "any"] as const).map((code) => (
                    <label key={code} className="flex items-center gap-1">
                      <Checkbox checked={(step.on_error ?? []).includes(code)} onCheckedChange={() => toggleErr(i, code)} />
                      {code}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button
            disabled={chain.length === 0 || !name.trim()}
            onClick={() => onSave({ id: initial?.id, name: name.trim(), is_default: isDefault, chain })}
          >
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
