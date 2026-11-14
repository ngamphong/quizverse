"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigured } from "./config";

let client: SupabaseClient | null = null;

/** Browser client (login / logout only). Returns null when Supabase is not configured. */
export function supabaseBrowser(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  return (client ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY));
}
