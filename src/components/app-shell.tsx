import type { ReactNode } from "react";
import { Search, LogOut, User as UserIcon, Keyboard } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommandPalette } from "./command-palette";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
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
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
              className="relative flex h-9 max-w-md flex-1 items-center gap-2 rounded-md border border-border bg-background px-3 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Search className="h-4 w-4" />
              <span className="truncate">{t("search")}</span>
              <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:inline-block">
                ⌘K
              </kbd>
            </button>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                title={lang === "th" ? "คีย์ลัด (?)" : "Keyboard shortcuts (?)"}
                onClick={() => window.dispatchEvent(new CustomEvent("open-shortcuts"))}
              >
                <Keyboard className="h-4 w-4" />
              </Button>
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
      <CommandPalette />
      <KeyboardShortcuts />
    </SidebarProvider>
  );
}
