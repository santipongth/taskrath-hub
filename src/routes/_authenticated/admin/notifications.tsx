import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  getNotificationSettings,
  updateNotificationSettings,
  sendLineNotification,
  type NotificationSettings,
} from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Save, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  head: () => ({ meta: [{ title: "การแจ้งเตือน · TaskRath Admin" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { lang } = useI18n();
  const L = (th: string, en: string) => (lang === "th" ? th : en);
  const qc = useQueryClient();
  const fetchCfg = useServerFn(getNotificationSettings);
  const saveCfg = useServerFn(updateNotificationSettings);
  const sendLine = useServerFn(sendLineNotification);

  const { data, isLoading } = useQuery({ queryKey: ["notif-cfg"], queryFn: () => fetchCfg() });
  const [form, setForm] = useState<NotificationSettings | null>(null);
  const [testMsg, setTestMsg] = useState("📢 ทดสอบการแจ้งเตือนจาก TaskRath");
  useEffect(() => { if (data && !form) setForm(data); }, [data, form]);

  const mut = useMutation({
    mutationFn: (v: NotificationSettings) => saveCfg({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-cfg"] });
      toast.success(L("บันทึกแล้ว", "Saved"));
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const test = useMutation({
    mutationFn: () =>
      sendLine({
        data: {
          message: testMsg,
          override: form
            ? { broadcast: form.lineBroadcast, targetId: form.lineTargetId }
            : undefined,
        },
      }),
    onSuccess: () => toast.success(L("ส่งข้อความทดสอบแล้ว", "Test message sent")),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  if (isLoading || !form) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 px-6 py-8">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Bell className="h-5 w-5 text-primary" />
          {L("การแจ้งเตือน", "Notifications")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {L("เชื่อมต่อ LINE Official Account ของหน่วยงานเพื่อรับการแจ้งเตือนสถานะคำร้อง", "Connect your agency's LINE Official Account to receive request status alerts")}
        </p>
      </div>

      <div className="space-y-5 rounded-lg border border-border bg-card p-5">
        <Toggle
          label={L("เปิดใช้งานการแจ้งเตือนผ่าน LINE", "Enable LINE notifications")}
          desc={L("ต้องตั้งค่า LINE_CHANNEL_ACCESS_TOKEN ในระบบแล้ว", "Requires LINE_CHANNEL_ACCESS_TOKEN to be configured")}
          checked={form.lineEnabled}
          onChange={(v) => setForm({ ...form, lineEnabled: v })}
        />
        <Toggle
          label={L("ส่งแบบ Broadcast (ทุกคนที่ติดตาม OA)", "Broadcast to all OA followers")}
          desc={L("ปิดเพื่อส่งเข้ากลุ่ม/ผู้ใช้เจาะจง", "Disable to push to a specific user/group/room")}
          checked={form.lineBroadcast}
          onChange={(v) => setForm({ ...form, lineBroadcast: v })}
        />
        {!form.lineBroadcast && (
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {L("LINE Target ID (userId / groupId / roomId)", "LINE Target ID")}
            </Label>
            <Input
              value={form.lineTargetId}
              placeholder="Uxxxxxxxx... or Cxxxxxxx..."
              onChange={(e) => setForm({ ...form, lineTargetId: e.target.value })}
            />
          </div>
        )}

        <div className="border-t border-border pt-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">{L("กิจกรรมที่จะแจ้งเตือน", "Trigger events")}</h2>
          <div className="space-y-3">
            <Toggle
              label={L("เมื่อมีคำขออนุมัติใหม่", "When a new approval is requested")}
              checked={form.notifyOnApproval}
              onChange={(v) => setForm({ ...form, notifyOnApproval: v })}
            />
            <Toggle
              label={L("เมื่อรันงาน AI เสร็จสิ้น", "When an AI run completes")}
              checked={form.notifyOnComplete}
              onChange={(v) => setForm({ ...form, notifyOnComplete: v })}
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button onClick={() => mut.mutate(form)} disabled={mut.isPending}>
            <Save className="mr-1.5 h-4 w-4" />
            {mut.isPending ? L("กำลังบันทึก…", "Saving…") : L("บันทึก", "Save")}
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-3 rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">{L("ทดสอบส่งข้อความ", "Send test message")}</h2>
        <Textarea rows={3} value={testMsg} onChange={(e) => setTestMsg(e.target.value)} />
        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => test.mutate()} disabled={test.isPending}>
            <Send className="mr-1.5 h-4 w-4" />
            {test.isPending ? L("กำลังส่ง…", "Sending…") : L("ส่งทดสอบ", "Send test")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
