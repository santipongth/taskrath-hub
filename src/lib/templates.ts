import {
  FileAudio, Mail, Inbox, StickyNote, Calculator, FileText,
  FileSignature, Stamp, Megaphone, MessagesSquare, Languages,
  SpellCheck, Scale, CalendarClock, ShieldCheck, Tags, type LucideIcon,
} from "lucide-react";

export type TemplateCategory = "meeting" | "letter" | "analysis" | "legal" | "citizen";

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
  id: string;
  icon: LucideIcon;
  titleTh: string;
  titleEn: string;
  descTh: string;
  descEn: string;
  category: TemplateCategory;
  systemPromptTh: string;
  fields: TemplateField[];
};

export const TEMPLATES: Template[] = [
  {
    id: "meeting-summary",
    icon: FileAudio,
    titleTh: "สรุปการประชุม",
    titleEn: "Meeting Summary",
    descTh: "สรุปประเด็น มติ และมอบหมายงานจากบันทึกการประชุม",
    descEn: "Summarize topics, decisions, and action items from a meeting",
    category: "meeting",
    systemPromptTh: "คุณเป็นเลขานุการที่ปรึกษาด้านการประชุมราชการ จงสรุปการประชุมในรูปแบบทางการ มีหัวข้อ: วาระ, ประเด็นสำคัญ, มติที่ประชุม, และผู้รับผิดชอบ",
    fields: [
      { name: "transcript", labelTh: "บันทึก/ถอดเสียงการประชุม", labelEn: "Transcript / notes", type: "textarea", required: true },
      { name: "attendees", labelTh: "ผู้เข้าร่วม", labelEn: "Attendees", type: "text" },
      { name: "date", labelTh: "วันที่ประชุม", labelEn: "Date", type: "text" },
    ],
  },
  {
    id: "external-letter",
    icon: Mail,
    titleTh: "ร่างหนังสือภายนอก",
    titleEn: "External Official Letter",
    descTh: "ร่างหนังสือราชการภายนอกตามระเบียบงานสารบรรณ",
    descEn: "Draft an outgoing official letter per government style",
    category: "letter",
    systemPromptTh: "คุณเป็นเจ้าหน้าที่สารบรรณราชการ จงร่างหนังสือภายนอกตามระเบียบสำนักนายกรัฐมนตรีว่าด้วยงานสารบรรณ พ.ศ. 2526 ใช้ภาษาทางการ",
    fields: [
      { name: "to", labelTh: "ถึง (หน่วยงาน)", labelEn: "To (organization)", type: "text", required: true },
      { name: "subject", labelTh: "เรื่อง", labelEn: "Subject", type: "text", required: true },
      { name: "purpose", labelTh: "วัตถุประสงค์/เนื้อหา", labelEn: "Purpose / content", type: "textarea", required: true },
    ],
  },
  {
    id: "internal-letter",
    icon: Inbox,
    titleTh: "ร่างหนังสือภายใน",
    titleEn: "Internal Official Letter",
    descTh: "ร่างหนังสือเวียน/สั่งการภายในหน่วยงาน",
    descEn: "Draft an internal circular or directive",
    category: "letter",
    systemPromptTh: "จงร่างหนังสือภายในตามระเบียบงานสารบรรณ มีหัวข้อ ที่/วันที่/เรื่อง/เรียน/เนื้อหา/ลงนาม",
    fields: [
      { name: "to", labelTh: "เรียน", labelEn: "To", type: "text", required: true },
      { name: "subject", labelTh: "เรื่อง", labelEn: "Subject", type: "text", required: true },
      { name: "content", labelTh: "เนื้อหา", labelEn: "Content", type: "textarea", required: true },
    ],
  },
  {
    id: "memo",
    icon: StickyNote,
    titleTh: "บันทึกข้อความ",
    titleEn: "Memo Draft",
    descTh: "ร่างบันทึกข้อความตามแบบฟอร์มราชการ",
    descEn: "Draft a memo using the official template",
    category: "letter",
    systemPromptTh: "จงร่างบันทึกข้อความตามแบบฟอร์มราชการไทย ส่วนหัวประกอบด้วย ส่วนราชการ ที่ วันที่ เรื่อง เรียน",
    fields: [
      { name: "to", labelTh: "เรียน", labelEn: "To", type: "text", required: true },
      { name: "subject", labelTh: "เรื่อง", labelEn: "Subject", type: "text", required: true },
      { name: "content", labelTh: "เนื้อหา", labelEn: "Content", type: "textarea", required: true },
    ],
  },
  {
    id: "budget-analysis",
    icon: Calculator,
    titleTh: "วิเคราะห์งบประมาณ",
    titleEn: "Budget Analysis",
    descTh: "วิเคราะห์โครงสร้างงบประมาณ ความเสี่ยง และข้อเสนอแนะ",
    descEn: "Analyze budget structure, risks, and recommendations",
    category: "analysis",
    systemPromptTh: "คุณเป็นนักวิเคราะห์งบประมาณภาครัฐ จงวิเคราะห์ข้อมูลในมุมความสมเหตุสมผล ประสิทธิภาพ ความเสี่ยง และเสนอแนะ",
    fields: [
      { name: "data", labelTh: "ข้อมูลงบประมาณ", labelEn: "Budget data", type: "textarea", required: true },
      { name: "context", labelTh: "บริบทโครงการ", labelEn: "Project context", type: "textarea" },
    ],
  },
  {
    id: "doc-summary",
    icon: FileText,
    titleTh: "สรุปเอกสารยาว",
    titleEn: "Document Summarization",
    descTh: "สรุปเอกสารยาวเป็นประเด็นสำคัญพร้อม Bullet",
    descEn: "Summarize long documents into key bullet points",
    category: "analysis",
    systemPromptTh: "จงสรุปเอกสารเป็นประเด็นสำคัญแบบ bullet ครอบคลุมสาระและข้อสรุป",
    fields: [
      { name: "document", labelTh: "ข้อความเอกสาร", labelEn: "Document text", type: "textarea", required: true },
    ],
  },
  {
    id: "tor-draft",
    icon: FileSignature,
    titleTh: "ร่าง TOR",
    titleEn: "TOR Draft",
    descTh: "ร่างข้อกำหนดเงื่อนไข (TOR) สำหรับการจัดซื้อจัดจ้าง",
    descEn: "Draft Terms of Reference for procurement",
    category: "letter",
    systemPromptTh: "จงร่าง TOR ตามระเบียบจัดซื้อจัดจ้าง ครอบคลุม ความเป็นมา วัตถุประสงค์ ขอบเขตงาน คุณสมบัติผู้เสนอ ระยะเวลา เงื่อนไขชำระเงิน",
    fields: [
      { name: "project", labelTh: "ชื่อโครงการ", labelEn: "Project name", type: "text", required: true },
      { name: "scope", labelTh: "ขอบเขตงาน", labelEn: "Scope", type: "textarea", required: true },
      { name: "budget", labelTh: "งบประมาณ (บาท)", labelEn: "Budget (THB)", type: "text" },
    ],
  },
  {
    id: "appointment-order",
    icon: Stamp,
    titleTh: "ร่างคำสั่งแต่งตั้ง",
    titleEn: "Appointment Order Draft",
    descTh: "ร่างคำสั่งแต่งตั้งคณะกรรมการหรือคณะทำงาน",
    descEn: "Draft an appointment order for a committee or working group",
    category: "letter",
    systemPromptTh: "จงร่างคำสั่งแต่งตั้งคณะทำงาน ระบุ องค์ประกอบ อำนาจหน้าที่ และวันที่ลงนาม",
    fields: [
      { name: "purpose", labelTh: "ภารกิจ/วัตถุประสงค์", labelEn: "Purpose", type: "textarea", required: true },
      { name: "members", labelTh: "รายชื่อคณะทำงาน", labelEn: "Members", type: "textarea" },
    ],
  },
  {
    id: "announcement",
    icon: Megaphone,
    titleTh: "ร่างประกาศ",
    titleEn: "Public Announcement",
    descTh: "ร่างประกาศของหน่วยงานสำหรับเผยแพร่ต่อสาธารณะ",
    descEn: "Draft a public announcement",
    category: "citizen",
    systemPromptTh: "จงร่างประกาศหน่วยงานราชการในรูปแบบทางการ พร้อมส่วนหัว เนื้อหา และวันที่ประกาศ",
    fields: [
      { name: "topic", labelTh: "เรื่อง", labelEn: "Topic", type: "text", required: true },
      { name: "details", labelTh: "รายละเอียด", labelEn: "Details", type: "textarea", required: true },
    ],
  },
  {
    id: "complaint-reply",
    icon: MessagesSquare,
    titleTh: "ตอบข้อร้องเรียนประชาชน",
    titleEn: "Citizen Complaint Reply",
    descTh: "ร่างหนังสือตอบกลับข้อร้องเรียนของประชาชนอย่างสุภาพ",
    descEn: "Draft a courteous reply to a citizen complaint",
    category: "citizen",
    systemPromptTh: "จงร่างหนังสือตอบข้อร้องเรียนของประชาชน ใช้ภาษาสุภาพ ชัดเจน และระบุแนวทางดำเนินการ",
    fields: [
      { name: "complaint", labelTh: "ข้อร้องเรียน", labelEn: "Complaint", type: "textarea", required: true },
      { name: "action", labelTh: "การดำเนินการของหน่วยงาน", labelEn: "Agency action", type: "textarea" },
    ],
  },
  {
    id: "translate",
    icon: Languages,
    titleTh: "แปลเอกสารราชการ TH↔EN",
    titleEn: "Official Translation TH↔EN",
    descTh: "แปลเอกสารราชการระหว่างภาษาไทยและอังกฤษ",
    descEn: "Translate official documents between Thai and English",
    category: "letter",
    systemPromptTh: "จงแปลเอกสารโดยรักษาความเป็นทางการ คำเฉพาะ และโครงสร้างของต้นฉบับ",
    fields: [
      { name: "text", labelTh: "ข้อความ", labelEn: "Text", type: "textarea", required: true },
      { name: "target", labelTh: "ภาษาปลายทาง (TH/EN)", labelEn: "Target language (TH/EN)", type: "text", required: true },
    ],
  },
  {
    id: "proofread",
    icon: SpellCheck,
    titleTh: "ตรวจร่างเอกสาร & คำผิด",
    titleEn: "Document QA & Proofread",
    descTh: "ตรวจการสะกด ไวยากรณ์ และโทนภาษาราชการ",
    descEn: "Check spelling, grammar, and official tone",
    category: "analysis",
    systemPromptTh: "จงตรวจสอบเอกสาร แก้คำผิด ไวยากรณ์ และปรับโทนให้เป็นทางการ พร้อมสรุปการแก้ไข",
    fields: [
      { name: "document", labelTh: "ข้อความ", labelEn: "Document text", type: "textarea", required: true },
    ],
  },
  {
    id: "law-summary",
    icon: Scale,
    titleTh: "สรุปกฎหมาย/ระเบียบ",
    titleEn: "Law & Regulation Summary",
    descTh: "สรุปสาระสำคัญของกฎหมาย ระเบียบ หรือประกาศ",
    descEn: "Summarize the essence of a law, regulation, or notice",
    category: "legal",
    systemPromptTh: "จงสรุปกฎหมาย/ระเบียบเป็นภาษาเข้าใจง่าย ระบุผู้บังคับใช้ ผู้ได้รับผลกระทบ และข้อควรระวัง",
    fields: [
      { name: "text", labelTh: "ตัวบทกฎหมาย/ระเบียบ", labelEn: "Legal text", type: "textarea", required: true },
    ],
  },
  {
    id: "agenda",
    icon: CalendarClock,
    titleTh: "ร่างวาระการประชุม",
    titleEn: "Meeting Agenda Draft",
    descTh: "ร่างวาระประชุมตามรูปแบบราชการ",
    descEn: "Draft a meeting agenda in the official format",
    category: "meeting",
    systemPromptTh: "จงร่างวาระการประชุมตามรูปแบบราชการไทย: วาระที่ 1 เรื่องประธานแจ้ง, วาระที่ 2 รับรองรายงานการประชุม, วาระที่ 3 เรื่องสืบเนื่อง, วาระที่ 4 เรื่องเพื่อพิจารณา, วาระที่ 5 เรื่องอื่น ๆ",
    fields: [
      { name: "topic", labelTh: "เรื่อง/หัวข้อประชุม", labelEn: "Meeting topic", type: "text", required: true },
      { name: "items", labelTh: "หัวข้อที่ต้องการบรรจุ", labelEn: "Items to include", type: "textarea" },
    ],
  },
];

export const TEMPLATES_BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));
