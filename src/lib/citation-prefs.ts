import { useEffect, useState } from "react";

export type CitationStyle = "inline_only" | "with_panel";

const KEY_STYLE = "notebook.citationStyle";
const KEY_INLINE = "notebook.showInlineCitations";
const EVT = "citation-style-change";

export function getCitationStyle(): CitationStyle {
  if (typeof window === "undefined") return "with_panel";
  const v = window.localStorage.getItem(KEY_STYLE);
  return v === "inline_only" ? "inline_only" : "with_panel";
}

export function setCitationStyle(v: CitationStyle) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_STYLE, v);
  window.dispatchEvent(new CustomEvent(EVT, { detail: { style: v } }));
}

export function getShowInlineCitations(): boolean {
  if (typeof window === "undefined") return true;
  const v = window.localStorage.getItem(KEY_INLINE);
  return v !== "false";
}

export function setShowInlineCitations(v: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_INLINE, String(v));
  window.dispatchEvent(new CustomEvent(EVT, { detail: { inline: v } }));
}

export function useCitationStyle(): [CitationStyle, (v: CitationStyle) => void] {
  const [s, setS] = useState<CitationStyle>(() => getCitationStyle());
  useEffect(() => {
    const onChange = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d && typeof d.style === "string") setS(d.style as CitationStyle);
      else if (!d || d.style === undefined) setS(getCitationStyle());
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

export function useShowInlineCitations(): [boolean, (v: boolean) => void] {
  const [s, setS] = useState<boolean>(() => getShowInlineCitations());
  useEffect(() => {
    const onChange = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d && typeof d.inline === "boolean") setS(d.inline);
      else if (!d || d.inline === undefined) setS(getShowInlineCitations());
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
      setShowInlineCitations(v);
      setS(v);
    },
  ];
}
