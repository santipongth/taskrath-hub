# 10 — Templates Engine

## สองแหล่ง (รวมกันแสดงในหน้า `/templates`)

### A) Built-in (`src/lib/templates.ts`)
Hard-code ใน array `TEMPLATES: Template[]`

```ts
export type TemplateField = {
  name: string;
  labelTh: string;
  labelEn: string;
  type: "text" | "textarea";
  required?: boolean;
  placeholderTh?: string;
  placeholderEn?: string;
};

export type Template = {
  id: string;                    // slug, unique
  icon: LucideIcon;
  titleTh: string; titleEn: string;
  descTh: string;  descEn: string;
  category: "meeting"|"letter"|"analysis"|"legal"|"citizen";
  systemPromptTh: string;        // ส่งเข้า role: "system"
  fields: TemplateField[];       // ฟอร์มกรอกข้อมูล
};
```

System prompt ทั้งหมดยัง mirror อยู่ใน `TEMPLATE_PROMPTS` ของ `ai.functions.ts` (server เรียกจากที่นั่นเพื่อไม่ต้อง bundle รูป icon)

### B) Custom (`custom_templates` table)
Admin สร้างใน `/admin/templates`:
- `slug` (unique), `title_th`, `title_en`, `desc_th`, `desc_en`
- `category` (enum เดียวกับ built-in)
- `icon_name` (string → resolve ผ่าน `template-icons.ts`)
- `system_prompt_th` (textarea ยาว)
- `fields` (jsonb array ตาม `TemplateField`)
- `is_active` (boolean)
- `created_by`, `created_at`, `updated_at`

CRUD serverFn อยู่ใน `src/lib/custom-templates.functions.ts`

### Merge
หน้า `/templates` และ `/run/$templateId`:
```ts
const builtIn = TEMPLATES.map(t => ({ ...t, source: "builtin" as const }));
const custom = customRows.map(r => ({
  id: r.slug,
  icon: getTemplateIcon(r.icon_name),
  titleTh: r.title_th, ...
  source: "custom" as const,
}));
const all = [...builtIn, ...custom];
```
ถ้า slug ชน → custom overrides builtin

## เทมเพลตที่ระบบมีอยู่
| Slug | ชื่อ | category |
|---|---|---|
| `meeting-summary` | สรุปการประชุม | meeting |
| `external-letter` | ร่างหนังสือภายนอก | letter |
| `internal-letter` | ร่างหนังสือภายใน | letter |
| `memo` | บันทึกข้อความ | letter |
| `budget-analysis` | วิเคราะห์งบประมาณ | analysis |
| `doc-summary` | สรุปเอกสาร | analysis |
| `tor-draft` | ร่าง TOR | legal |
| `appointment-order` | คำสั่งแต่งตั้ง | letter |
| `announcement` | ประกาศหน่วยงาน | letter |
| `complaint-reply` | ตอบข้อร้องเรียน | citizen |
| `translate` | แปลเอกสาร | analysis |
| `proofread` | ตรวจสอบเอกสาร | analysis |
| `law-summary` | สรุปกฎหมาย | legal |
| `agenda` | ร่างวาระประชุม | meeting |
| `appointment-committee` | คำสั่งแต่งตั้งคณะกรรมการ | letter |
| `kpr-meeting-report` | รายงานการประชุม กพร. | meeting |
| `procurement-tor` | TOR จัดซื้อจัดจ้าง | legal |
| `internal-control-py12` | แบบ ปย.1 / ปย.2 | analysis |
| `budget-request` | คำของบประมาณ | analysis |

## Pattern เพิ่มเทมเพลตใหม่ (built-in)
```ts
// 1) src/lib/templates.ts
{
  id: "new-slug",
  icon: FileText,
  titleTh: "...", titleEn: "...",
  descTh: "...",  descEn: "...",
  category: "letter",
  systemPromptTh: "คุณเป็น... จงร่าง... โดย...",
  fields: [
    { name: "subject", labelTh: "เรื่อง", labelEn: "Subject", type: "text", required: true },
    { name: "content", labelTh: "เนื้อหา", labelEn: "Content", type: "textarea", required: true },
  ],
}

// 2) src/lib/ai.functions.ts — เพิ่มใน TEMPLATE_PROMPTS
"new-slug": "คุณเป็น... จงร่าง... โดย...",
```

(แค่นี้ — ไม่ต้องเพิ่ม route, หน้า `/run/$templateId` รับทุก slug)

## Icon Resolver (`template-icons.ts`)
```ts
export const TEMPLATE_ICONS: Record<string, LucideIcon> = { FileText, ... };
export function getTemplateIcon(name?: string | null) {
  return (name && TEMPLATE_ICONS[name]) || FileText;
}
```
ใช้ในหน้า admin (custom_templates เก็บเป็น string)

## ข้อห้าม
- อย่าตั้ง slug ชนกับ built-in โดยไม่ตั้งใจ
- อย่าใส่ system prompt ที่ leak ข้อมูล user อื่น
- field name ต้องเป็น `[a-z][a-z0-9_]*` (ใช้ใน JSON key)
