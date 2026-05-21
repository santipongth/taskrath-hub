import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { messages, type Lang, type MessageKey } from "./messages";

type I18nCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: MessageKey) => string;
};

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("th");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("taskrath.lang") : null;
    if (stored === "th" || stored === "en") setLangState(stored);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("taskrath.lang", l);
  };

  const t = (key: MessageKey) => messages[key][lang];

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
