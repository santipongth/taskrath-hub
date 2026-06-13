import {
  FileAudio, Mail, Inbox, StickyNote, Calculator, FileText,
  FileSignature, Stamp, Megaphone, MessagesSquare, Languages,
  SpellCheck, Scale, CalendarClock, ShieldCheck, Tags,
  Users, ClipboardList, ShoppingCart, ShieldAlert, Coins,
  type LucideIcon,
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
  {
    id: "dopa-verify",
    icon: ShieldCheck,
    titleTh: "ตรวจสอบเอกสาร DOPA",
    titleEn: "DOPA Document Verification",
    descTh: "ตรวจความครบถ้วน/ผิดปกติของเอกสารทะเบียนราษฎร บัตรประชาชน หรือเอกสาร DOPA",
    descEn: "Check completeness and anomalies of civil registry / ID / DOPA documents",
    category: "legal",
    systemPromptTh: "คุณเป็นเจ้าหน้าที่ตรวจสอบเอกสารกรมการปกครอง (DOPA) จงตรวจสอบเอกสารที่ได้รับ ระบุ: (1) ประเภทเอกสารที่ระบุได้, (2) ฟิลด์ที่ครบถ้วน, (3) ฟิลด์ที่ขาดหายหรือไม่ชัดเจน, (4) จุดน่าสงสัย/ผิดปกติ (เลข ปชช. ไม่ครบ 13 หลัก, รูปแบบวันที่ผิด, ลายเซ็น/ตราประทับขาด), (5) คำแนะนำการดำเนินการต่อ ใช้ภาษาทางการ",
    fields: [
      { name: "doc_type", labelTh: "ประเภทเอกสาร (เช่น ทร.14, บัตร ปชช., ทะเบียนบ้าน)", labelEn: "Document type", type: "text", required: true },
      { name: "content", labelTh: "ข้อความเอกสาร (พิมพ์หรืออัปโหลดรูปเพื่อ OCR)", labelEn: "Document text", type: "textarea", required: true },
    ],
  },
  {
    id: "complaint-classify",
    icon: Tags,
    titleTh: "จำแนกข้อร้องเรียนประชาชน",
    titleEn: "Citizen Complaint Triage",
    descTh: "จำแนกประเภท ระดับความเร่งด่วน และหน่วยงานที่รับผิดชอบ พร้อมร่างคำตอบเบื้องต้น",
    descEn: "Classify category, urgency, responsible agency, and draft initial reply",
    category: "citizen",
    systemPromptTh: "คุณเป็นเจ้าหน้าที่ศูนย์รับเรื่องร้องเรียน จงวิเคราะห์ข้อร้องเรียนแล้วตอบในรูปแบบ:\n1. ประเภทเรื่อง (เช่น สาธารณูปโภค, ทุจริต, บริการประชาชน, สิ่งแวดล้อม ฯลฯ)\n2. ระดับความเร่งด่วน (สูง/กลาง/ต่ำ) พร้อมเหตุผล\n3. หน่วยงานที่ควรรับผิดชอบหลัก/รอง\n4. ข้อมูลที่ขาดและควรขอเพิ่ม\n5. ร่างคำตอบเบื้องต้นแก่ผู้ร้องด้วยภาษาสุภาพ",
    fields: [
      { name: "complaint", labelTh: "ข้อร้องเรียน", labelEn: "Complaint", type: "textarea", required: true },
      { name: "channel", labelTh: "ช่องทางที่รับเรื่อง (เช่น 1567, เว็บไซต์, เดินมา)", labelEn: "Channel", type: "text" },
    ],
  },
  {
    id: "appointment-committee",
    icon: Users,
    titleTh: "คำสั่งแต่งตั้งคณะกรรมการ",
    titleEn: "Committee Appointment Order",
    descTh: "ร่างคำสั่งแต่งตั้งคณะกรรมการ/คณะอนุกรรมการ พร้อมองค์ประกอบและอำนาจหน้าที่",
    descEn: "Draft a committee/sub-committee appointment order with composition and authority",
    category: "letter",
    systemPromptTh: "คุณเป็นเจ้าหน้าที่นิติการ จงร่างคำสั่งแต่งตั้งคณะกรรมการตามรูปแบบราชการ ประกอบด้วยส่วน: (1) เลขที่คำสั่ง/ปี (2) เรื่อง (3) คำปรารภอ้างเหตุและอำนาจตามกฎหมาย (4) องค์ประกอบคณะกรรมการ (ประธาน รองประธาน กรรมการ กรรมการและเลขานุการ ผู้ช่วยเลขานุการ) (5) อำนาจหน้าที่ (6) วันที่มีผลบังคับใช้ (7) ลงนามผู้มีอำนาจ ใช้สำนวนทางการ",
    fields: [
      { name: "order_no", labelTh: "เลขที่คำสั่ง (เช่น 12/2568)", labelEn: "Order number", type: "text", required: true },
      { name: "subject", labelTh: "เรื่อง / ภารกิจ", labelEn: "Subject / mission", type: "text", required: true },
      { name: "legal_basis", labelTh: "อำนาจตามกฎหมาย/ระเบียบที่อ้าง", labelEn: "Legal authority", type: "textarea" },
      { name: "members", labelTh: "รายชื่อ-ตำแหน่งกรรมการ (บรรทัดละคน)", labelEn: "Members list", type: "textarea", required: true },
      { name: "duties", labelTh: "อำนาจหน้าที่", labelEn: "Duties", type: "textarea", required: true },
      { name: "effective_date", labelTh: "วันที่มีผล", labelEn: "Effective date", type: "text" },
    ],
  },
  {
    id: "kpr-meeting-report",
    icon: ClipboardList,
    titleTh: "รายงานการประชุม กพร.",
    titleEn: "KPR Meeting Report",
    descTh: "รายงานการประชุมคณะกรรมการพัฒนาระบบราชการ (กพร.) ตามรูปแบบมาตรฐาน",
    descEn: "OPDC/KPR-style meeting report with standard structure",
    category: "meeting",
    systemPromptTh: "คุณเป็นเลขานุการ กพร. จงจัดทำรายงานการประชุมตามรูปแบบราชการ ครอบคลุม: (1) ส่วนหัว (ครั้งที่ วัน เวลา สถานที่) (2) ผู้มาประชุม/ผู้ไม่มา/ผู้เข้าร่วม (3) วาระที่ 1 เรื่องประธานแจ้ง (4) วาระที่ 2 รับรองรายงานการประชุมครั้งที่แล้ว (5) วาระที่ 3 เรื่องสืบเนื่อง (6) วาระที่ 4 เรื่องเพื่อพิจารณา พร้อม “มติที่ประชุม” แต่ละเรื่อง (7) วาระที่ 5 เรื่องอื่น ๆ (8) เลิกประชุมและผู้จดรายงาน/ผู้ตรวจรายงาน ใช้ภาษาทางการ สรุปสาระและมติให้ชัดเจน",
    fields: [
      { name: "meeting_no", labelTh: "ครั้งที่ / ปี", labelEn: "Meeting no/year", type: "text", required: true },
      { name: "datetime_place", labelTh: "วัน เวลา สถานที่", labelEn: "Date, time, venue", type: "text", required: true },
      { name: "attendees", labelTh: "ผู้เข้าประชุม / ผู้ไม่มา / ผู้เข้าร่วม", labelEn: "Attendees / absent / observers", type: "textarea", required: true },
      { name: "transcript", labelTh: "บันทึก/ถอดเสียงการประชุม", labelEn: "Transcript/notes", type: "textarea", required: true },
    ],
  },
  {
    id: "procurement-tor",
    icon: ShoppingCart,
    titleTh: "TOR จัดซื้อจัดจ้าง",
    titleEn: "Procurement TOR",
    descTh: "ร่างขอบเขตงาน (TOR) ตาม พ.ร.บ.การจัดซื้อจัดจ้างฯ 2560",
    descEn: "Draft Terms of Reference per Thai Public Procurement Act B.E. 2560",
    category: "letter",
    systemPromptTh: "คุณเป็นเจ้าหน้าที่พัสดุ จงร่างขอบเขตงาน (TOR) ตามพระราชบัญญัติการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 และระเบียบกระทรวงการคลังที่เกี่ยวข้อง ครอบคลุมหัวข้อ: (1) ความเป็นมาและความจำเป็น (2) วัตถุประสงค์ (3) คุณสมบัติผู้เสนอราคา/ผู้ยื่นข้อเสนอ (4) ขอบเขตของงาน/รายละเอียดคุณลักษณะเฉพาะ (5) ระยะเวลาดำเนินการและสถานที่ส่งมอบ (6) ราคากลางและงบประมาณ (7) หลักประกันสัญญา (8) การจ่ายเงิน/งวดงาน (9) ค่าปรับและการบอกเลิกสัญญา (10) เงื่อนไขอื่น ๆ ใช้ภาษาทางการ ระบุข้อกำหนดที่ชัดเจน ตรวจสอบได้ ไม่กีดกันการแข่งขัน",
    fields: [
      { name: "project_name", labelTh: "ชื่อโครงการ/งานจัดจ้าง", labelEn: "Project name", type: "text", required: true },
      { name: "method", labelTh: "วิธีจัดซื้อจัดจ้าง (e-bidding, คัดเลือก, เฉพาะเจาะจง)", labelEn: "Procurement method", type: "text", required: true },
      { name: "budget", labelTh: "งบประมาณ (บาท) / ราคากลาง", labelEn: "Budget (THB)", type: "text", required: true },
      { name: "scope", labelTh: "ขอบเขตงาน / คุณลักษณะเฉพาะ", labelEn: "Scope / specifications", type: "textarea", required: true },
      { name: "duration", labelTh: "ระยะเวลาดำเนินการ", labelEn: "Duration", type: "text" },
      { name: "qualifications", labelTh: "คุณสมบัติผู้เสนอ", labelEn: "Bidder qualifications", type: "textarea" },
    ],
  },
  {
    id: "internal-control-py12",
    icon: ShieldAlert,
    titleTh: "แบบ ปย.1 / ปย.2 (ควบคุมภายใน)",
    titleEn: "Internal Control Form PY1/PY2",
    descTh: "ร่างแบบประเมินความเสี่ยงและรายงานควบคุมภายใน (ปย.1 และ ปย.2) ตามหลักเกณฑ์ คตง.",
    descEn: "Internal control risk assessment and report forms (PY1 + PY2) per OAG guidelines",
    category: "analysis",
    systemPromptTh: "คุณเป็นผู้ตรวจสอบภายในของหน่วยงานราชการ จงจัดทำแบบ ปย.1 (รายงานผลการประเมินองค์ประกอบของการควบคุมภายใน) และแบบ ปย.2 (รายงานการประเมินผลและการปรับปรุงการควบคุมภายใน) ตามหลักเกณฑ์กระทรวงการคลังว่าด้วยมาตรฐานและหลักเกณฑ์ปฏิบัติการควบคุมภายในสำหรับหน่วยงานของรัฐ พ.ศ. 2561\n\nรูปแบบผลลัพธ์:\n=== ปย.1 ===\nองค์ประกอบ 5 ด้าน: (1) สภาพแวดล้อมการควบคุม (2) การประเมินความเสี่ยง (3) กิจกรรมการควบคุม (4) สารสนเทศและการสื่อสาร (5) การติดตามประเมินผล — ระบุผลการประเมินแต่ละด้าน (มี/ไม่มี/ต้องปรับปรุง) พร้อมคำอธิบาย\n\n=== ปย.2 ===\nตารางมีคอลัมน์: ภารกิจ/กระบวนการ | ความเสี่ยงที่ยังเหลืออยู่ | การควบคุมที่มีอยู่ | การประเมินผลการควบคุม | ความเสี่ยงที่ยังคงอยู่ | การปรับปรุงการควบคุม | หน่วยงาน/ผู้รับผิดชอบ | กำหนดเสร็จ",
    fields: [
      { name: "unit", labelTh: "ชื่อส่วนราชการ/หน่วยงาน", labelEn: "Unit name", type: "text", required: true },
      { name: "period", labelTh: "งวดประเมิน (เช่น ปีงบประมาณ 2568)", labelEn: "Period", type: "text", required: true },
      { name: "mission", labelTh: "ภารกิจ/กระบวนงานหลักที่ประเมิน", labelEn: "Mission/key processes", type: "textarea", required: true },
      { name: "risks", labelTh: "ความเสี่ยงที่พบ", labelEn: "Identified risks", type: "textarea", required: true },
      { name: "controls", labelTh: "การควบคุมที่มีอยู่ในปัจจุบัน", labelEn: "Existing controls", type: "textarea" },
    ],
  },
  {
    id: "budget-request",
    icon: Coins,
    titleTh: "คำของบประมาณ",
    titleEn: "Budget Request Proposal",
    descTh: "ร่างคำของบประมาณรายจ่ายประจำปี ตามรูปแบบสำนักงบประมาณ",
    descEn: "Draft annual budget request per Bureau of the Budget format",
    category: "analysis",
    systemPromptTh: "คุณเป็นเจ้าหน้าที่วิเคราะห์งบประมาณ จงร่างคำของบประมาณรายจ่ายประจำปีตามรูปแบบสำนักงบประมาณ ครอบคลุม: (1) ชื่อโครงการ/ผลผลิต-กิจกรรม (2) ความสอดคล้องกับยุทธศาสตร์ชาติ/แผนแม่บท/นโยบายรัฐบาล (3) หลักการและเหตุผล/สภาพปัญหา (4) วัตถุประสงค์ (5) กลุ่มเป้าหมายและพื้นที่ดำเนินการ (6) ตัวชี้วัด (เชิงปริมาณ/เชิงคุณภาพ/เวลา/ต้นทุน) (7) วิธีดำเนินการและแผนปฏิบัติงานรายไตรมาส (8) งบประมาณจำแนกตามหมวด (งบบุคลากร งบดำเนินงาน งบลงทุน งบเงินอุดหนุน งบรายจ่ายอื่น) พร้อมเหตุผลความจำเป็นของแต่ละหมวด (9) ผลที่คาดว่าจะได้รับและความคุ้มค่า (10) ความเสี่ยงและแนวทางจัดการ ใช้ภาษาทางการ ตัวเลขชัดเจน",
    fields: [
      { name: "project", labelTh: "ชื่อโครงการ", labelEn: "Project name", type: "text", required: true },
      { name: "fiscal_year", labelTh: "ปีงบประมาณ", labelEn: "Fiscal year", type: "text", required: true },
      { name: "strategy", labelTh: "ยุทธศาสตร์/แผนที่สอดคล้อง", labelEn: "Aligned strategy", type: "textarea" },
      { name: "rationale", labelTh: "หลักการ เหตุผล สภาพปัญหา", labelEn: "Rationale", type: "textarea", required: true },
      { name: "objectives", labelTh: "วัตถุประสงค์ และ KPI", labelEn: "Objectives & KPIs", type: "textarea", required: true },
      { name: "budget_total", labelTh: "วงเงินที่ขอ (บาท) และการจำแนกหมวด", labelEn: "Budget breakdown", type: "textarea", required: true },
      { name: "target_group", labelTh: "กลุ่มเป้าหมาย/พื้นที่", labelEn: "Target/area", type: "text" },
    ],
  },
];

export const TEMPLATES_BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));
