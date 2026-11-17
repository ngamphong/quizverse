import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/supabase/config";

/** Keeps the Supabase login session fresh on every request (Next.js 16 "proxy", formerly middleware). */
export async function proxy(request: NextRequest) {
  if (!supabaseConfigured) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list, headers) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  // hot paths (polled every 2-3 s or hit on every answer) skip the session refresh: they identify players by token
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/live/state|api/live/answer|api/game/answer|api/game/next|api/featured|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
