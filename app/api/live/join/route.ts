import { NextResponse } from "next/server";
import { fail, tooMany } from "@/lib/server/http";
import { joinLive } from "@/lib/server/live";
import { rateLimited } from "@/lib/server/rateLimit";
import { currentUserId, supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** POST { pin, nickname } → { playerId, token } (signed-in players use their profile name). */
export async function POST(req: Request) {
  if (rateLimited(req, "live-join", 30)) return tooMany();
  try {
    const body = await req.json().catch(() => ({}));
    const uid = await currentUserId(await supabaseServer());
    return NextResponse.json(await joinLive(String(body.pin ?? ""), String(body.nickname ?? ""), uid));
  } catch (e) {
    return fail(e);
  }
}
