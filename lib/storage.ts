"use client";
/**
 * Browser storage (localStorage): guest Learning DNA, the guest player name,
 * and the teacher's unpublished drafts. Published quizzes and signed-in users'
 * Learning DNA live in Supabase (see profileStore.ts and /api/*).
 */
import { exampleProfile } from "./profile";
import type { Draft, Profile } from "./types";

const key = (k: string) => "qv_" + k;

function read<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key(k));
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(k: string, v: unknown) {
  try { localStorage.setItem(key(k), JSON.stringify(v)); } catch { /* storage blocked: keep working in memory */ }
}

export function loadProfile(): Profile { return read<Profile | null>("profile", null) ?? exampleProfile(); }
export function saveProfile(p: Profile) {
  write("profile", p);
  window.dispatchEvent(new Event("qv-profile"));
}

export function loadDrafts(): Draft[] { const d = read<Draft[]>("drafts", []); return Array.isArray(d) ? d : []; }
export function saveDrafts(d: Draft[]) { write("drafts", d); }

export function toast(msg: string) { window.dispatchEvent(new CustomEvent("qv-toast", { detail: msg })); }
