import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard, Sparkles, LibraryBig, History, Bot, Plug,
  ShieldCheck, Settings, BarChart3, PieChart, Building2, Bell, BookText, MessageSquare,
  LayoutTemplate, Telescope, FolderKanban,
} from "lucide-react";

import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n";
import logo from "@/assets/rathcowork-icon.png.asset.json";
import type { MessageKey } from "@/lib/messages";
import { checkIsAdmin } from "@/lib/ai.functions";

const ITEMS: { to: string; key: MessageKey; icon: typeof LayoutDashboard; labelTh?: string; labelEn?: string }[] = [
  { to: "/", key: "nav_dashboard", icon: LayoutDashboard },
  { to: "/run", key: "nav_run", icon: Sparkles },
  
  { to: "/chat", key: "nav_chat", icon: MessageSquare },
  { to: "/research", key: "nav_research", icon: Telescope },
  { to: "/projects", key: "nav_run", icon: FolderKanban, labelTh: "Notebooks", labelEn: "Notebooks" },
  { to: "/templates", key: "nav_templates", icon: LibraryBig },
  { to: "/history", key: "nav_history", icon: History },
  { to: "/settings", key: "nav_settings", icon: Settings },
];


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { t, lang } = useI18n();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const fetchIsAdmin = useServerFn(checkIsAdmin);
  const { data: adminData } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => fetchIsAdmin(),
    staleTime: 5 * 60 * 1000,
  });
  const isAdmin = adminData?.isAdmin ?? false;

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className={`px-2 py-0 gap-0`}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/"
                className="flex w-full items-center justify-center rounded-lg border border-transparent transition-colors hover:border-accent hover:bg-accent/10 focus-visible:border-accent focus-visible:bg-accent/10 focus-visible:outline-none cursor-pointer"
              >
                <img
                  src={logo.url}
                  alt={t("appName")}
                  className={`object-contain transition-all ${collapsed ? "h-9 w-auto" : "h-16 w-auto max-w-full"}`}
                />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{t("appName")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {ITEMS.map((item) => {
                const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                const label = item.labelTh && item.labelEn ? (lang === "th" ? item.labelTh : item.labelEn) : t(item.key);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={label}>
                      <Link to={item.to} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span className="truncate">{label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel>{t("adminGroupLabel")}</SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                <AdminItem to="/admin/dashboard" icon={PieChart} labelTh="แดชบอร์ดผู้บริหาร" labelEn="Executive" pathname={pathname} collapsed={collapsed} lang={lang} />
                <AdminItem to="/admin/usage" icon={BarChart3} labelTh="การใช้งาน" labelEn="Usage" pathname={pathname} collapsed={collapsed} lang={lang} />
                <AdminItem to="/admin/knowledge" icon={BookText} labelTh="คลังความรู้" labelEn="Knowledge" pathname={pathname} collapsed={collapsed} lang={lang} />
                <AdminItem to="/admin/templates" icon={LayoutTemplate} labelTh="เทมเพลตของหน่วยงาน" labelEn="Custom Templates" pathname={pathname} collapsed={collapsed} lang={lang} />
                <AdminItem to="/agents" icon={Bot} labelTh="Agent & Skills" labelEn="Agents & Skills" pathname={pathname} collapsed={collapsed} lang={lang} />
                <AdminItem to="/integrations" icon={Plug} labelTh="เชื่อมระบบ" labelEn="Integrations" pathname={pathname} collapsed={collapsed} lang={lang} />
                <AdminItem to="/governance" icon={ShieldCheck} labelTh="ธรรมาภิบาล" labelEn="Governance" pathname={pathname} collapsed={collapsed} lang={lang} />
                <AdminItem to="/admin/notifications" icon={Bell} labelTh="การแจ้งเตือน" labelEn="Notifications" pathname={pathname} collapsed={collapsed} lang={lang} />
                <AdminItem to="/admin/settings" icon={Building2} labelTh="ตั้งค่าหน่วยงาน" labelEn="Agency" pathname={pathname} collapsed={collapsed} lang={lang} />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

function AdminItem({
  to, icon: Icon, labelTh, labelEn, pathname, collapsed, lang,
}: {
  to: "/admin/dashboard" | "/admin/usage" | "/admin/knowledge" | "/admin/templates" | "/admin/notifications" | "/admin/settings" | "/agents" | "/integrations" | "/governance";
  icon: typeof LayoutDashboard;
  labelTh: string;
  labelEn: string;
  pathname: string;
  collapsed: boolean;
  lang: string;
}) {
  const label = lang === "th" ? labelTh : labelEn;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={pathname.startsWith(to)} tooltip={label}>
        <Link to={to} className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {!collapsed && <span className="truncate">{label}</span>}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
