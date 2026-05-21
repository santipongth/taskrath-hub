import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "เข้าสู่ระบบ · TaskRath" }],
  }),
  beforeLoad: async () => {
    // Client-only check — server has no Supabase session and would never
    // redirect, but checking here on the client prevents a logged-in user
    // from seeing the login form.
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  component: LoginPage,
});

function LoginPage() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const onGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Sign-in failed");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success(lang === "th" ? "สมัครสำเร็จ ตรวจสอบอีเมลเพื่อยืนยัน" : "Check your email to confirm");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-semibold">T</div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">TaskRath</span>
              <span className="text-[11px] text-muted-foreground">ทาสก์-รัฐ</span>
            </div>
          </Link>
          <div className="flex items-center rounded-md border border-border p-0.5 text-xs">
            <button onClick={() => setLang("th")} className={`rounded px-2 py-1 ${lang === "th" ? "bg-muted" : "text-muted-foreground"}`}>TH</button>
            <button onClick={() => setLang("en")} className={`rounded px-2 py-1 ${lang === "en" ? "bg-muted" : "text-muted-foreground"}`}>EN</button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background p-6">
          <h1 className="text-lg font-semibold text-foreground">
            {mode === "signin" ? t("signIn") : t("signUp")}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">{t("appTagline")}</p>

          <Button
            type="button"
            variant="outline"
            className="mt-5 w-full"
            disabled={loading}
            onClick={onGoogle}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09A6.97 6.97 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.43 3.44 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
            {t("continueWithGoogle")}
          </Button>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("orDivider")}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="displayName" className="text-xs">{t("displayName")}</Label>
                <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">{t("email")}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">{t("password")}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("running") : mode === "signin" ? t("signIn") : t("signUp")}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-primary hover:underline"
            >
              {mode === "signin"
                ? lang === "th" ? "ยังไม่มีบัญชี? สมัครใช้งาน" : "No account? Sign up"
                : lang === "th" ? "มีบัญชีแล้ว? เข้าสู่ระบบ" : "Have an account? Sign in"}
            </button>
            <ForgotPasswordButton />
          </div>
        </div>
      </div>
    </div>
  );
}

function ForgotPasswordButton() {
  const { lang } = useI18n();
  const onClick = async () => {
    const email = window.prompt(lang === "th" ? "กรอกอีเมล" : "Enter your email");
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success(lang === "th" ? "ส่งลิงก์รีเซ็ตแล้ว" : "Reset link sent");
  };
  return (
    <button type="button" onClick={onClick} className="text-muted-foreground hover:text-foreground">
      {lang === "th" ? "ลืมรหัสผ่าน?" : "Forgot password?"}
    </button>
  );
}
