import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UserSkill = {
  id: string;
  name: string;
  icon: string | null;
  role_prompt: string;
  default_model_selector: string | null;
  sort_order: number;
};

const MAX_SKILLS = 30;
const MAX_NAME = 80;
const MAX_PROMPT = 4000;

const DEFAULT_SKILLS: Array<{ name: string; icon: string; role_prompt: string }> = [
  {
    name: "หนังสือราชการ",
    icon: "FileSignature",
    role_prompt:
      "คุณเป็นเจ้าหน้าที่สารบรรณ ร่างหนังสือราชการตามระเบียบสำนักนายกฯ ว่าด้วยงานสารบรรณ พ.ศ. 2526 ใช้ภาษาทางการ กระชับ ตรงประเด็น และระบุส่วนหัวให้ถูกต้อง",
  },
  {
    name: "แปลภาษาเชิงวิชาการ",
    icon: "Languages",
    role_prompt:
      "คุณเป็นนักแปลเชิงวิชาการ TH↔EN เน้นความถูกต้องของศัพท์เฉพาะ คงโครงสร้างต้นฉบับ คงน้ำเสียงทางการ และอธิบายคำที่กำกวมในวงเล็บ",
  },
  {
    name: "สรุปทุน/โครงการต่างประเทศ",
    icon: "Sparkles",
    role_prompt:
      "คุณเป็นนักวิเคราะห์ทุนการศึกษา/โครงการระหว่างประเทศ สรุปประเด็นต่อไปนี้: ชื่อทุน ผู้ให้ทุน คุณสมบัติผู้สมัคร มูลค่า/ผลประโยชน์ deadline ขั้นตอนการสมัคร และเหมาะกับใครในบริบทมหาวิทยาลัยไทย",
  },
  {
    name: "เขียนข่าว PR",
    icon: "Megaphone",
    role_prompt:
      "คุณเป็น PR officer ของมหาวิทยาลัย เขียนข่าวประชาสัมพันธ์ภาษาไทย โครงสร้าง 5W1H พาดหัวกระชับ ย่อหน้าแรกตอบสาระสำคัญทั้งหมด มีคำคมผู้บริหารและ call-to-action",
  },
  {
    name: "วาง Outline พรีเซนต์เทชัน",
    icon: "LayoutTemplate",
    role_prompt:
      "คุณเป็นที่ปรึกษานำเสนอผู้บริหาร วางโครงสไลด์ทีละหน้า ระบุ: หัวข้อ, bullet หลัก 3-5 ข้อ/หน้า, ภาพประกอบที่ควรใช้, และ speaker note สั้น ๆ เน้นเรื่องที่ผู้บริหารต้องตัดสินใจ",
  },
  {
    name: "Brief สำหรับโปสเตอร์/Infographic",
    icon: "Stamp",
    role_prompt:
      "คุณเป็น Creative Director ออกแบบ brief สำหรับโปสเตอร์/Infographic ระบุ: เป้าหมาย, กลุ่มเป้าหมาย, key message, ขนาด/สัดส่วน, โทนสี, ลำดับชั้นข้อมูล (visual hierarchy), copy ที่ใช้บนชิ้นงาน, และ CTA",
  },
  {
    name: "Script วิดีโอประชาสัมพันธ์",
    icon: "FileText",
    role_prompt:
      "คุณเป็น Video Scriptwriter เขียนสคริปต์วิดีโอประชาสัมพันธ์ (30s / 60s / 3min) แยกคอลัมน์ Scene | Visual | Voice-over | On-screen text เน้น hook ใน 3 วินาทีแรก",
  },
  {
    name: "Coding Helper",
    icon: "Cpu",
    role_prompt:
      "คุณเป็น Senior Engineer ช่วยเขียน/อ่าน/แก้โค้ด ตอบเป็นภาษาไทยแต่โค้ดเป็นภาษาต้นทาง อธิบายเหตุผลสั้น ๆ ระบุ edge case และเสนอวิธีทดสอบ",
  },
];

export const listMySkills = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_skills")
      .select("id, name, icon, role_prompt, default_model_selector, sort_order")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { skills: (data ?? []) as UserSkill[] };
  });

export const seedDefaultSkills = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { count } = await supabase
      .from("user_skills")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) > 0) return { ok: true, inserted: 0 };
    const rows = DEFAULT_SKILLS.map((s, i) => ({
      user_id: userId,
      name: s.name,
      icon: s.icon,
      role_prompt: s.role_prompt,
      sort_order: i,
    }));
    const { error } = await supabase.from("user_skills").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, inserted: rows.length };
  });

export const upsertSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(MAX_NAME),
        icon: z.string().trim().max(40).optional().nullable(),
        role_prompt: z.string().trim().min(1).max(MAX_PROMPT),
        default_model_selector: z.string().trim().max(120).optional().nullable(),
        sort_order: z.number().int().min(0).max(9999).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.id) {
      const { count } = await supabase
        .from("user_skills")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if ((count ?? 0) >= MAX_SKILLS) throw new Error(`เก็บได้สูงสุด ${MAX_SKILLS} skill`);
      const { data: row, error } = await supabase
        .from("user_skills")
        .insert({
          user_id: userId,
          name: data.name,
          icon: data.icon ?? null,
          role_prompt: data.role_prompt,
          default_model_selector: data.default_model_selector ?? null,
          sort_order: data.sort_order ?? 0,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: row.id as string };
    } else {
      const { error } = await supabase
        .from("user_skills")
        .update({
          name: data.name,
          icon: data.icon ?? null,
          role_prompt: data.role_prompt,
          default_model_selector: data.default_model_selector ?? null,
          sort_order: data.sort_order ?? 0,
        })
        .eq("id", data.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
  });

export const deleteSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_skills")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadSkillPrompt(supabase: any, userId: string, skillId: string | null | undefined): Promise<string> {
  if (!skillId) return "";
  const { data } = await supabase
    .from("user_skills")
    .select("role_prompt")
    .eq("id", skillId)
    .eq("user_id", userId)
    .maybeSingle();
  const prompt = (data?.role_prompt as string | null) ?? null;
  if (!prompt) return "";
  return `\n\n<บทบาทที่ผู้ใช้กำหนด>\n${prompt}\n</บทบาทที่ผู้ใช้กำหนด>`;
}
