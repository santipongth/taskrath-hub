export type Lang = "th" | "en";

export type Msg = { th: string; en: string };

export const messages = {
  appName: { th: "ทาสก์-รัฐ", en: "TaskRath" },
  appTagline: {
    th: "ผู้ช่วย AI สำหรับงานราชการ",
    en: "AI assistant for government work",
  },

  // Nav
  nav_dashboard: { th: "หน้าหลัก", en: "Dashboard" },
  nav_run: { th: "สั่งงาน AI", en: "Run AI" },
  nav_templates: { th: "คลังงานสำเร็จรูป", en: "Template Library" },
  nav_history: { th: "ประวัติการใช้งาน", en: "History" },
  nav_agents: { th: "Agent & Skills", en: "Agents & Skills" },
  nav_integrations: { th: "เชื่อมระบบ", en: "Integrations" },
  nav_governance: { th: "ธรรมาภิบาล", en: "Governance" },
  nav_settings: { th: "ตั้งค่า", en: "Settings" },

  // Common
  search: { th: "ค้นหา…", en: "Search…" },
  signIn: { th: "เข้าสู่ระบบ", en: "Sign in" },
  signOut: { th: "ออกจากระบบ", en: "Sign out" },
  signUp: { th: "สมัครใช้งาน", en: "Sign up" },
  email: { th: "อีเมล", en: "Email" },
  password: { th: "รหัสผ่าน", en: "Password" },
  displayName: { th: "ชื่อที่แสดง", en: "Display name" },
  continueWithGoogle: { th: "เข้าสู่ระบบด้วย Google", en: "Continue with Google" },
  orDivider: { th: "หรือใช้อีเมล", en: "or with email" },
  back: { th: "ย้อนกลับ", en: "Back" },
  run: { th: "เริ่มงาน", en: "Run" },
  running: { th: "กำลังประมวลผล…", en: "Working…" },
  copy: { th: "คัดลอก", en: "Copy" },
  copied: { th: "คัดลอกแล้ว", en: "Copied" },
  save: { th: "บันทึก", en: "Save" },
  empty: { th: "ยังไม่มีข้อมูล", en: "No data yet" },

  // Dashboard
  greetingMorning: { th: "อรุณสวัสดิ์", en: "Good morning" },
  greetingAfternoon: { th: "สวัสดีตอนบ่าย", en: "Good afternoon" },
  greetingEvening: { th: "สวัสดีตอนเย็น", en: "Good evening" },
  statRunsWeek: { th: "งานสัปดาห์นี้", en: "Tasks this week" },
  statTemplates: { th: "เทมเพลตทั้งหมด", en: "Templates" },
  quickActions: { th: "คลังงานสำเร็จรูป", en: "Template Library" },
  quickActionsDesc: {
    th: "เลือกเทมเพลตเพื่อเริ่มงานได้ทันที",
    en: "Pick a template to start in seconds",
  },

  // Run
  freeformTitle: { th: "สั่งงาน AI", en: "Run AI" },
  freeformDesc: {
    th: "พิมพ์คำสั่งงานเป็นภาษาไทยหรืออังกฤษได้",
    en: "Describe your task in Thai or English",
  },
  freeformPlaceholder: {
    th: "เช่น สรุปการประชุมเมื่อวานในรูปแบบที่เป็นทางการ…",
    en: "e.g., Summarize yesterday's meeting in a formal tone…",
  },
  result: { th: "ผลลัพธ์", en: "Result" },

  // Templates
  templateCategories: { th: "หมวดหมู่", en: "Categories" },
  cat_all: { th: "ทั้งหมด", en: "All" },
  cat_meeting: { th: "การประชุม", en: "Meetings" },
  cat_letter: { th: "หนังสือราชการ", en: "Official letters" },
  cat_analysis: { th: "วิเคราะห์", en: "Analysis" },
  cat_legal: { th: "กฎหมาย/ระเบียบ", en: "Legal" },
  cat_citizen: { th: "บริการประชาชน", en: "Citizen services" },

  // History
  historyTitle: { th: "ประวัติการใช้งาน", en: "History" },
  historyEmpty: { th: "ยังไม่มีประวัติงาน", en: "No past runs yet" },


  // Governance
  governanceTitle: { th: "ธรรมาภิบาล", en: "Governance" },
  governanceDesc: {
    th: "ตรวจสอบการใช้งาน AI และนโยบายข้อมูล",
    en: "Audit AI usage and data policy",
  },

  // Agents
  agentsTitle: { th: "Agent & Skills", en: "Agents & Skills" },
  agentsDesc: {
    th: "Agent และทักษะที่เชื่อมต่อกับ HiClaw",
    en: "Agents and skills connected via HiClaw",
  },

  // Integrations
  integrationsTitle: { th: "เชื่อมระบบ", en: "Integrations" },
  integrationsDesc: {
    th: "เชื่อมต่อกับระบบราชการและเครื่องมือภายนอก",
    en: "Connect to government systems and external tools",
  },

  // Settings
  settingsTitle: { th: "ตั้งค่า", en: "Settings" },
  settingsLanguage: { th: "ภาษา", en: "Language" },
  settingsDepartment: { th: "สังกัด/หน่วยงาน", en: "Department" },

  // OCR / PII
  ocrUpload: { th: "อัปโหลดรูปเอกสาร (OCR)", en: "Upload image (OCR)" },
  ocrExtracting: { th: "กำลังถอดข้อความ…", en: "Extracting text…" },
  ocrSuccess: { th: "ถอดข้อความสำเร็จ", en: "Text extracted" },
  piiRedacted: { th: "ปกปิด PII", en: "PII redacted" },
  auditLogTitle: { th: "บันทึกการใช้งาน", en: "Audit log" },
  auditLogEmpty: { th: "ยังไม่มีบันทึก", en: "No audit entries yet" },
} as const;

export type MessageKey = keyof typeof messages;
