# 13 — i18n & Localization

## ระบบ
- Provider: `src/lib/i18n.tsx`
- Messages: `src/lib/messages.ts` (single source of truth)
- ภาษา: `th` (default) | `en`
- เก็บ preference ใน `profiles.language` (localStorage fallback)

## API
```ts
import { useI18n } from "@/lib/i18n";

function MyComponent() {
  const { t, lang, setLang } = useI18n();
  return <h1>{t("nav_dashboard")}</h1>;
}
```

## Message Shape
```ts
type Msg = { th: string; en: string };

export const messages = {
  appName: { th: "ทาสก์-รัฐ", en: "TaskRath" },
  nav_dashboard: { th: "หน้าหลัก", en: "Dashboard" },
  // ...
} as const;

export type MessageKey = keyof typeof messages;
```

## Naming Convention ของ key
| Prefix | ใช้ตอน |
|---|---|
| `nav_*` | menu/navigation |
| `cat_*` | category label |
| `export_*` | export dialog |
| `auditLog*` | audit page |
| `settings*` | settings page |
| `agents*`, `integrations*`, `governance*` | per-page section |
| ไม่มี prefix | คำใช้ทั่วไป (`save`, `back`, `copy`) |

> ใช้ camelCase ภายใน key อยู่แล้ว (`signIn`, `displayName`) — แต่ของใหม่แนะนำ snake_case ตาม `nav_*`, `export_*` เพื่อ consistency

## Pattern เพิ่ม key
```ts
// 1) เพิ่มใน messages.ts
my_new_label: { th: "ข้อความใหม่", en: "New label" },

// 2) ใช้ใน component
const { t } = useI18n();
<span>{t("my_new_label")}</span>
```

> ❌ อย่า hard-code string ทั้งใน TH หรือ EN ใน component
> ❌ อย่าใช้ key ที่ไม่มีใน `messages` (TypeScript จะฟ้อง)

## Tone Guide (ภาษาไทย — ราชการ)
| สถานการณ์ | ใช้ | เลี่ยง |
|---|---|---|
| Button หลัก | สั้น ตรง — "บันทึก", "ส่งออก", "เริ่มงาน" | "ทำการบันทึก", "กดเพื่อบันทึก" |
| Success toast | "บันทึกแล้ว", "ส่งออกสำเร็จ" | "การบันทึกของท่านได้เสร็จสมบูรณ์แล้ว" |
| Error | "ไม่สามารถ{verb}ได้ ลองอีกครั้ง" + รายละเอียดเพิ่ม | คำเทคนิคดิบ ๆ |
| Empty state | คำชวนเริ่ม — "ยังไม่มีงาน เริ่มที่{...}" | "ไม่พบข้อมูล" เปล่า ๆ |
| Confirm dialog | "ยืนยันการลบ{...}? ไม่สามารถย้อนได้" | "Are you sure?" |
| Field label เอกสาร | ใช้คำตามสารบรรณ — "เรื่อง", "เรียน", "สิ่งที่ส่งมาด้วย" | คำแปลตรง |

## Tone Guide (English)
- Button: Title Case verb ("Save", "Export", "Run")
- Description: sentence case
- ใช้ "you/your" ไม่ใช่ "the user"

## เปลี่ยนภาษา
- มี `<LangSwitcher />` ใน settings + (อาจ) header
- เรียก `setLang("en")` → update localStorage + (ถ้า login) profile.language

## ภาษาที่จะเพิ่มในอนาคต (อาจไม่ทำ)
ถ้าจะเพิ่ม `lo` (ลาว) / `km` (เขมร) / `my` (พม่า) ต้อง:
1. ขยาย type `Lang`
2. เพิ่ม key ทุก message
3. ตรวจ font (Noto Sans มีหลายภาษา)
4. ตรวจ AI gateway model รองรับ
