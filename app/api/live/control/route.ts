import { NextResponse } from "next/server";
import { fail } from "@/lib/server/http";
import { control, hostRoom } from "@/lib/server/live";
import { currentUserId, supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** POST { room, action: start | reveal | next | end } — host only. */
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const room = await hostRoom(String(b.room ?? ""), await currentUserId(await supabaseServer()));
    await control(room, String(b.action ?? ""));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
