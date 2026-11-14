"use client";
/** Light / dark / follow-the-device theme, remembered per browser. */
export type ThemePref = "light" | "dark" | "system";
const KEY = "qv_theme";

export function getThemePref(): ThemePref {
  try { const v = localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : "system"; } catch { return "system"; }
}

export function effectiveTheme(pref: ThemePref): "light" | "dark" {
  if (pref !== "system") return pref;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function setThemePref(pref: ThemePref) {
  try { if (pref === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, pref); } catch { /* ignore */ }
  if (pref === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", pref);
  window.dispatchEvent(new Event("qv-theme"));
}
