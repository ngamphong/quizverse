import { NextResponse } from "next/server";
import { fail } from "@/lib/server/http";
import { getState, hostRoom, playerAuth } from "@/lib/server/live";
import { currentUserId, supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?room=<id> (host, by login) or ?pid=<player id>&token=<token> (player) → LiveState */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const roomId = sp.get("room");
    if (roomId) {
      const room = await hostRoom(roomId, await currentUserId(await supabaseServer()));
      return NextResponse.json(await getState(room, { host: true }));
    }
    const { player, room } = await playerAuth(sp.get("pid") ?? "", sp.get("token") ?? "");
    return NextResponse.json(await getState(room, { player }));
  } catch (e) {
    return fail(e);
  }
}
