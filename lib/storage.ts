"use client";
/**
 * Phase 1 keeps data in the browser (localStorage). Phase 3 replaces these
 * functions with Supabase calls; the pages only use this module.
 */
import { exampleProfile } from "./profile";
import { SAMPLE_QUIZ } from "./sampleQuiz";
import type { Draft, Profile, Quiz } from "./types";

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

export function loadQuizzes(): Quiz[] {
  const own = read<Quiz[]>("quizzes", []);
  return [SAMPLE_QUIZ, ...(Array.isArray(own) ? own.filter((q) => !q.example) : [])];
}
export function saveQuizzes(all: Quiz[]) { write("quizzes", all.filter((q) => !q.example)); }

export function loadProfile(): Profile { return read<Profile | null>("profile", null) ?? exampleProfile(); }
export function saveProfile(p: Profile) {
  write("profile", p);
  window.dispatchEvent(new Event("qv-profile"));
}

export function loadDrafts(): Draft[] { const d = read<Draft[]>("drafts", []); return Array.isArray(d) ? d : []; }
export function saveDrafts(d: Draft[]) { write("drafts", d); }

export function toast(msg: string) { window.dispatchEvent(new CustomEvent("qv-toast", { detail: msg })); }
