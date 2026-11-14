import { NextResponse } from "next/server";
import { startGame } from "@/lib/server/game";
import { fail, tooMany } from "@/lib/server/http";
import { rateLimited } from "@/lib/server/rateLimit";
import { currentUserId, supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Body: { pin, nickname } → session id + token + first question (no answer key). */
export async function POST(req: Request) {
  if (rateLimited(req, "game", 40)) return tooMany();
  try {
    const body = await req.json().catch(() => ({}));
    const userId = await currentUserId(await supabaseServer());
    return NextResponse.json(await startGame(String(body.pin ?? ""), String(body.nickname ?? ""), userId));
  } catch (e) {
    return fail(e);
  }
}
