# 05 — UI Components

## shadcn/ui (`src/components/ui/`)
ครบชุดมาตรฐาน: `button`, `card`, `dialog`, `sheet`, `dropdown-menu`, `select`, `tabs`, `table`, `toast` (sonner), `sidebar`, `form`, `input`, `textarea`, `command`, `popover`, `tooltip`, `alert-dialog`, etc.

> อย่าแก้ไฟล์ใน `ui/` ตรง ๆ — สร้าง variant ใหม่ผ่าน `cva` หรือ wrapper component แทน

## Custom Components (`src/components/`)

### `app-shell.tsx`
Wrapper layout: `<SidebarProvider>` + `<AppSidebar />` + main content + `<Toaster />` + `<CommandPalette />`

### `app-sidebar.tsx`
- Collapsible sidebar (รอง mobile sheet)
- หัว: badge "T" + ชื่อแอป "TaskRath / ทาสก์-รัฐ"
- เมนูหลัก: Dashboard, Run, Chat, Templates, History, Settings
- เมนู Admin (เฉพาะ `isAdmin`): Dashboard, Usage, Knowledge, Custom Templates, Agency Settings, Notifications
- ใช้ `useQuery(["is-admin"], checkIsAdmin)` ตรวจสิทธิ์

### `command-palette.tsx`
`cmdk` palette เปิดด้วย `⌘K` — ลัดไปหน้า/เทมเพลต/chat ใหม่

### `template-card.tsx`
แสดง icon + ชื่อ TH/EN + คำอธิบาย + ปุ่ม favorite — ใช้ในหน้า `/templates`

### `citations-list.tsx`
แสดง `Citation[]` (จาก RAG): `[1] doc title — snippet …`
รับ prop: `citations: Citation[]` ที่ shape:
```ts
{ doc_id, chunk_id, title, score, snippet }
```

### `refine-bar.tsx`
แถบล่างของหน้า run result — ปุ่มปรับโทน (เป็นทางการขึ้น/สั้นลง/แปลไทย…) + ช่องเขียนคำสั่งเพิ่ม

### `export-dialog.tsx`
Dialog ส่งออกเอกสาร — ดู `11-export-signatures.md`
- เลือกชั้นความลับ / ชั้นความเร็ว
- เลขที่หนังสือ + ผู้รับ
- toggle ใส่ letterhead (ตราครุฑ)
- toggle ลายเซ็นดิจิทัล + QR
- ปุ่มดาวน์โหลด PDF/DOCX

## AI Elements (`src/components/ai-elements/`)
ติดตั้งผ่าน `bun x ai-elements@latest add conversation message prompt-input shimmer`

ใช้ในหน้า `chat/$threadId.tsx`:
- `Conversation`, `ConversationContent`, `ConversationScrollButton`
- `Message`, `MessageContent`, `MessageResponse` (สำหรับ markdown streaming)
- `PromptInput`, `PromptInputTextarea`, `PromptInputFooter`, `PromptInputSubmit`
- `Shimmer` (สถานะ "กำลังคิด…")

### กติกาสำคัญ (จาก chat-ui-composition)
- Assistant message: **ไม่มีพื้นหลัง** เรนเดอร์บน chat surface ตรง ๆ
- User message: ใช้ filled bubble — pair token `primary` + `primary-foreground`
- ห้ามใช้ `Sparkles` เป็น identity ของ agent
- Tool result accordion: `defaultOpen={false}`

## Toast / Notification
- `sonner` ผ่าน `<Toaster />` ใน app-shell
- ใช้ `toast.success(...)`, `toast.error(...)` — ภาษาตาม current lang

## Forms
- `react-hook-form` + `zod` + `@hookform/resolvers/zod`
- ใช้ `Form`, `FormField`, `FormItem`, `FormLabel`, `FormMessage` จาก shadcn

## Loading States
- หน้าเดี่ยว: `<Skeleton />`
- streaming text: AI Elements `Shimmer` หรือ inline dots
- ปุ่ม async: `disabled` + spinner icon (`Loader2 className="animate-spin"`)
