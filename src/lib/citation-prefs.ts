import { useEffect, useState } from "react";

export type CitationStyle = "inline_only" | "with_panel";

const KEY = "notebook.citationStyle";
const EVT = "citation-style-change";

export function getCitationStyle(): CitationStyle {
  if (typeof window === "undefined") return "with_panel";
  const v = window.localStorage.getItem(KEY);
  return v === "inline_only" ? "inline_only" : "with_panel";
}

export function setCitationStyle(v: CitationStyle) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, v);
  window.dispatchEvent(new CustomEvent(EVT, { detail: v }));
}

export function useCitationStyle(): [CitationStyle, (v: CitationStyle) => void] {
  const [s, setS] = useState<CitationStyle>(() => getCitationStyle());
  useEffect(() => {
    const onChange = (e: Event) => {
      const v = (e as CustomEvent).detail as CitationStyle | undefined;
      if (v) setS(v);
      else setS(getCitationStyle());
    };
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return [
    s,
    (v) => {
      setCitationStyle(v);
      setS(v);
    },
  ];
}
