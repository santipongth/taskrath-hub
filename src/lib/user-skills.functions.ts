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
  description: string | null;
  example_output: string | null;
};

const MAX_SKILLS = 30;
const MAX_NAME = 80;
const MAX_PROMPT = 4000;

const DEFAULT_SKILLS: Array<{ name: string; icon: string; role_prompt: string; description: string; example_output: string }> = [
  {
    name: "หนังสือราชการ",
    icon: "FileSignature",
    role_prompt:
      "คุณเป็นเจ้าหน้าที่สารบรรณ ร่างหนังสือราชการตามระเบียบสำนักนายกฯ ว่าด้วยงานสารบรรณ พ.ศ. 2526 ใช้ภาษาทางการ กระชับ ตรงประเด็น และระบุส่วนหัวให้ถูกต้อง",
    description: "ร่างหนังสือราชการตามระเบียบสำนักนายกฯ ว่าด้วยงานสารบรรณ พ.ศ. 2526",
    example_output: "ที่ ศธ 0406.4/ว.284\nเรื่อง ขอความอนุเคราะห์รับนิสิตเข้าร่วมโครงการ...\n\nเรียน คณบดีคณะ...\n\nสำนักงานวิเทศสัมพันธ์...",
  },
  {
    name: "แปลภาษาเชิงวิชาการ",
    icon: "Languages",
    role_prompt:
      "คุณเป็นนักแปลเชิงวิชาการ TH↔EN เน้นความถูกต้องของศัพท์เฉพาะ คงโครงสร้างต้นฉบับ คงน้ำเสียงทางการ และอธิบายคำที่กำกวมในวงเล็บ",
    description: "แปลภาษาไทย↔อังกฤษเชิงวิชาการ คงโครงสร้างและศัพท์เฉพาะ",
    example_output: "This Memorandum of Understanding (MoU) is made on...\n\nความเข้าใจในบันทึกข้อตกลงฉบับนี้จัดทำขึ้นเมื่อ...",
  },
  {
    name: "สรุปทุน/โครงการต่างประเทศ",
    icon: "Sparkles",
    role_prompt:
      "คุณเป็นนักวิเคราะห์ทุนการศึกษา/โครงการระหว่างประเทศ สรุปประเด็นต่อไปนี้: ชื่อทุน ผู้ให้ทุน คุณสมบัติผู้สมัคร มูลค่า/ผลประโยชน์ deadline ขั้นตอนการสมัคร และเหมาะกับใครในบริบทมหาวิทยาลัยไทย",
    description: "สรุปรายละเอียดทุน มูลค่า คุณสมบัติ deadline และขั้นตอนการสมัคร",
    example_output: "ทุน Erasmus Mundus Joint Masters\nผู้ให้ทุน: สหภาพยุโรป\nมูลค่า: เต็มจำนวน (Full Scholarship)\nDeadline: 15 มีนาคม 2026\nคุณสมบัติ: จบปริญญาตรี GPA ≥ 3.0...",
  },
  {
    name: "เขียนข่าว PR",
    icon: "Megaphone",
    role_prompt:
      "คุณเป็น PR officer ของมหาวิทยาลัย เขียนข่าวประชาสัมพันธ์ภาษาไทย โครงสร้าง 5W1H พาดหัวกระชับ ย่อหน้าแรกตอบสาระสำคัญทั้งหมด มีคำคมผู้บริหารและ call-to-action",
    description: "เขียนข่าวประชาสัมพันธ์ 5W1H พร้อมพาดหัวกระชับและ call-to-action",
    example_output: "มหาวิทยาลัยราชภัฏฯ ลงนามความร่วมมือกับมหาวิทยาลัย XYZ ประเทศญี่ปุ่น\n\nวันนี้ (20 มิ.ย. 68) ผศ.ดร.สมชาย ใจดี...",
  },
  {
    name: "วาง Outline พรีเซนต์เทชัน",
    icon: "LayoutTemplate",
    role_prompt:
      "คุณเป็นที่ปรึกษานำเสนอผู้บริหาร วางโครงสไลด์ทีละหน้า ระบุ: หัวข้อ, bullet หลัก 3-5 ข้อ/หน้า, ภาพประกอบที่ควรใช้, และ speaker note สั้น ๆ เน้นเรื่องที่ผู้บริหารต้องตัดสินใจ",
    description: "วางโครงสไลด์ พร้อม bullet ภาพประกอบ และ speaker note สั้น ๆ",
    example_output: "Slide 1 – หัวข้อ: ความร่วมมือระหว่างประเทศ 2026\n• Bullet: จำนวนข้อตกลง MOU ที่ลงนาม\n• ภาพ: แผนที่โลก + ธงชาติ\nSpeaker Note: เน้นว่าเป็นครั้งแรกที่...",
  },
  {
    name: "Brief สำหรับโปสเตอร์/Infographic",
    icon: "Stamp",
    role_prompt:
      "คุณเป็น Creative Director ออกแบบ brief สำหรับโปสเตอร์/Infographic ระบุ: เป้าหมาย, กลุ่มเป้าหมาย, key message, ขนาด/สัดส่วน, โทนสี, ลำดับชั้นข้อมูล (visual hierarchy), copy ที่ใช้บนชิ้นงาน, และ CTA",
    description: "ออกแบบ brief สำหรับนักออกแบบ พร้อม key message visual hierarchy และ CTA",
    example_output: "เป้าหมาย: ประชาสัมพันธ์โครงการแลกเปลี่ยน\nกลุ่มเป้าหมาย: นิสิตปริญญาตรีปี 2-3\nKey Message: \"โอกาสเรียนต่อต่างประเทศฟรี!\"\nโทนสี: ฟ้า-ขาว\nCTA: สมัครได้ที่...",
  },
  {
    name: "Script วิดีโอประชาสัมพันธ์",
    icon: "FileText",
    role_prompt:
      "คุณเป็น Video Scriptwriter เขียนสคริปต์วิดีโอประชาสัมพันธ์ (30s / 60s / 3min) แยกคอลัมน์ Scene | Visual | Voice-over | On-screen text เน้น hook ใน 3 วินาทีแรก",
    description: "เขียนสคริปต์วิดีโอแยก Scene | Visual | Voice-over | On-screen text",
    example_output: "Scene 1 | Visual: มุมกว้างมหาวิทยาลัยยามเช้า | VO: คุณเคยฝันเรียนต่อต่างประเทศหรือไม่? | Text: เรียนต่อต่างประเทศฟรี\nScene 2 | Visual: นิสิตยิ้มกล้อง | VO: มหาวิทยาลัยฯ มีทุนมากกว่า 20 รายการ...",
  },
  {
    name: "Coding Helper",
    icon: "Cpu",
    role_prompt:
      "คุณเป็น Senior Engineer ช่วยเขียน/อ่าน/แก้โค้ด ตอบเป็นภาษาไทยแต่โค้ดเป็นภาษาต้นทาง อธิบายเหตุผลสั้น ๆ ระบุ edge case และเสนอวิธีทดสอบ",
    description: "ช่วยเขียน/แก้โค้ด พร้อมอธิบายภาษาไทย และระบุ edge case",
    example_output: "function calculateGPA(scores) {\n  if (!Array.isArray(scores)) throw new Error('scores must be array');\n  return scores.reduce((a,b)=>a+b,0)/scores.length;\n}\n\nอธิบาย: ฟังก์ชันนี้รับ array ของคะแนน...\nEdge case: ถ้า scores ว่าง จะได้ NaN — ควรเพิ่ม guard clause",
  },
];

export const listMySkills = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_skills")
      .select("id, name, icon, role_prompt, default_model_selector, sort_order, description, example_output")
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
      description: s.description,
      example_output: s.example_output,
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
