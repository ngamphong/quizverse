"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "./supabase/client";

export interface Me {
  id: string;
  name: string;
  /** for display only — the server always re-checks the role in the database */
  role: "teacher" | "student";
}

/** Signed-in user (null = guest). `loading` is true until the first check finishes. */
export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) { setLoading(false); return; }
    const apply = (u: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null) => {
      setMe(u ? {
        id: u.id,
        name: String(u.user_metadata?.display_name || u.email?.split("@")[0] || "ผู้ใช้"),
        role: u.user_metadata?.role === "teacher" ? "teacher" : "student",
      } : null);
      setLoading(false);
    };
    sb.auth.getUser().then(({ data }) => apply(data.user));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => apply(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { me, loading };
}
