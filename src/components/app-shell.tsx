import type { ReactNode } from "react";
import { Search, LogOut, User as UserIcon } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export function AppShell({ children, userEmail }: { children: ReactNode; userEmail?: string | null }) {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center gap-3 border-b border-border bg-background px-4">
            <SidebarTrigger className="text-muted-foreground" />
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("search")}
                className="h-9 border-border bg-background pl-9 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center rounded-md border border-border p-0.5 text-xs">
                <button
                  onClick={() => setLang("th")}
                  className={`rounded px-2 py-1 transition-colors ${lang === "th" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  TH
                </button>
                <button
                  onClick={() => setLang("en")}
                  className={`rounded px-2 py-1 transition-colors ${lang === "en" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  EN
                </button>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <UserIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                    {userEmail ?? ""}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    {t("signOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
