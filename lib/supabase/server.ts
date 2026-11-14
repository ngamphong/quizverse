import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { HttpError } from "../server/http";
import { DB_OFF_NOTE, SUPABASE_KEY, SUPABASE_URL, supabaseConfigured } from "./config";

/** Acts as the signed-in user (Row Level Security applies). */
export async function supabaseServer(): Promise<SupabaseClient> {
  if (!supabaseConfigured) throw new HttpError(503, DB_OFF_NOTE);
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* called from a place that cannot set cookies; proxy.ts refreshes them */ }
      },
    },
  });
}

/** The signed-in user's id, verified from the JWT; null for guests. */
export async function currentUserId(sb: SupabaseClient): Promise<string | null> {
  const { data } = await sb.auth.getClaims();
  const sub = data?.claims?.sub;
  return typeof sub === "string" ? sub : null;
}

const SECRET = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
let admin: SupabaseClient | null = null;

/**
 * Full-access client for the game engine (reads answer keys, writes sessions).
 * Server only — the secret key must never be sent to the browser.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!supabaseConfigured || !SECRET) throw new HttpError(503, DB_OFF_NOTE);
  return (admin ??= createClient(SUPABASE_URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } }));
}
