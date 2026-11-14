import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Email-confirmation link lands here: swap the one-time code for a login session. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    try {
      const sb = await supabaseServer();
      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL("/", url.origin));
    } catch { /* fall through */ }
  }
  return NextResponse.redirect(new URL("/login?error=confirm", url.origin));
}
