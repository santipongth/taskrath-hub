import { createFileRoute, Link } from "@tanstack/react-router";
import { fetchVerifySignature, type VerifySignature } from "@/lib/signatures.functions";
import { ShieldCheck, ShieldX, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/verify/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `ตรวจสอบลายเซ็นดิจิทัล · ${params.id.slice(0, 8)} · RathCoWork` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ params }) => {
    const sig = await fetchVerifySignature(params.id);
    return { sig, id: params.id };
  },
  component: VerifyPage,
});

function thaiDateTime(iso: string) {
  const d = new Date(iso);
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543} เวลา ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")} น.`;
}

function VerifyPage() {
  const { sig, id } = Route.useLoaderData() as { sig: VerifySignature | null; id: string };

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <Link to="/" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> กลับหน้าหลัก
        </Link>

        {sig ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-3 border-b border-border bg-emerald-50 px-6 py-4 dark:bg-emerald-950/30">
              <ShieldCheck className="h-8 w-8 text-emerald-600" />
              <div>
                <h1 className="text-base font-semibold text-emerald-900 dark:text-emerald-100">ลายเซ็นดิจิทัลถูกต้อง</h1>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-100/70">
                  เอกสารนี้ได้รับการลงนามด้วยลายเซ็นอิเล็กทรอนิกส์ ตาม พ.ร.บ.ว่าด้วยธุรกรรมทางอิเล็กทรอนิกส์ พ.ศ. 2544
                </p>
              </div>
            </div>
            <dl className="divide-y divide-border text-sm">
              <Row label="ผู้ลงนาม" value={sig.signer_name} />
              {sig.signer_position && <Row label="ตำแหน่ง" value={sig.signer_position} />}
              {sig.agency_name && <Row label="หน่วยงาน" value={sig.agency_name} />}
              {sig.document_subject && <Row label="เรื่อง" value={sig.document_subject} />}
              {sig.ref_no && <Row label="เลขที่หนังสือ" value={sig.ref_no} />}
              <Row label="วันที่ลงนาม" value={thaiDateTime(sig.signed_at)} />
              <Row label="รหัสลายเซ็น" value={sig.id} mono />
              <Row label="ค่าแฮชเอกสาร (SHA-256)" value={sig.content_hash} mono breakAll />
            </dl>
            <div className="border-t border-border bg-muted/40 px-6 py-3 text-[11px] text-muted-foreground">
              หากเนื้อหาเอกสารถูกแก้ไขภายหลังการลงนาม ค่าแฮชจะเปลี่ยน และจะไม่ตรงกับค่าที่บันทึกไว้ในระบบ
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-3 border-b border-border bg-rose-50 px-6 py-4 dark:bg-rose-950/30">
              <ShieldX className="h-8 w-8 text-rose-600" />
              <div>
                <h1 className="text-base font-semibold text-rose-900 dark:text-rose-100">ไม่พบลายเซ็น</h1>
                <p className="text-xs text-rose-800/80 dark:text-rose-100/70">
                  ไม่พบข้อมูลลายเซ็นสำหรับรหัสนี้ในระบบ อาจเป็น QR ที่ไม่ถูกต้อง หรือถูกลบไปแล้ว
                </p>
              </div>
            </div>
            <p className="px-6 py-4 text-xs font-mono text-muted-foreground break-all">{id}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono, breakAll }: { label: string; value: string; mono?: boolean; breakAll?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-3 px-6 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`col-span-2 ${mono ? "font-mono text-xs" : ""} ${breakAll ? "break-all" : ""}`}>{value}</dd>
    </div>
  );
}
