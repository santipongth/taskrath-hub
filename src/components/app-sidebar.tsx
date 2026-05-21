import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Sparkles, LibraryBig, History, Bot, Plug,
  CheckCircle2, ShieldCheck, Settings,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/messages";

const ITEMS: { to: string; key: MessageKey; icon: typeof LayoutDashboard }[] = [
  { to: "/", key: "nav_dashboard", icon: LayoutDashboard },
  { to: "/run", key: "nav_run", icon: Sparkles },
  { to: "/templates", key: "nav_templates", icon: LibraryBig },
  { to: "/history", key: "nav_history", icon: History },
  { to: "/agents", key: "nav_agents", icon: Bot },
  { to: "/integrations", key: "nav_integrations", icon: Plug },
  { to: "/approvals", key: "nav_approvals", icon: CheckCircle2 },
  { to: "/governance", key: "nav_governance", icon: ShieldCheck },
  { to: "/settings", key: "nav_settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { t } = useI18n();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="px-3 py-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-semibold">
            T
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-foreground">TaskRath</span>
              <span className="text-[11px] text-muted-foreground">ทาสก์-รัฐ</span>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {ITEMS.map((item) => {
                const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={t(item.key)}>
                      <Link to={item.to} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span className="truncate">{t(item.key)}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
