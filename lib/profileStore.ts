"use client";
/**
 * Where Learning DNA lives: in the account (Supabase) when signed in,
 * otherwise in this browser (localStorage) for guests.
 */
import { loadProfile, saveProfile } from "./storage";
import { supabaseConfigured } from "./supabase/config";
import type { Profile } from "./types";

export async function fetchProfile(): Promise<{ profile: Profile; remote: boolean }> {
  if (supabaseConfigured) {
    try {
      const r = await fetch("/api/profile", { cache: "no-store" });
      if (r.ok) return { profile: (await r.json()).profile as Profile, remote: true };
    } catch { /* offline: fall back to local */ }
  }
  return { profile: loadProfile(), remote: false };
}

export async function storeProfile(p: Profile, remote: boolean) {
  if (remote) {
    const r = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ profile: p }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "บันทึกไม่สำเร็จ");
    window.dispatchEvent(new Event("qv-profile"));
  } else {
    saveProfile(p);
  }
}
