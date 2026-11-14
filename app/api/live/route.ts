import { NextResponse } from "next/server";
import { fail, HttpError, tooMany } from "@/lib/server/http";
import { createLive, isLivePin } from "@/lib/server/live";
import { rateLimited } from "@/lib/server/rateLimit";
import { currentUserId, supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?pin= → { live: boolean }  (join page decides live room vs solo quiz) */
export async function GET(req: Request) {
  try {
    const pin = new URL(req.url).searchParams.get("pin") ?? "";
    if (!/^\d{6}$/.test(pin)) return NextResponse.json({ live: false });
    return NextResponse.json({ live: await isLivePin(pin) });
  } catch (e) {
    return fail(e);
  }
}

/** POST { quizPin } → teacher opens a live room for one of their quizzes (or the sample). */
export async function POST(req: Request) {
  if (rateLimited(req, "live-create", 20)) return tooMany();
  try {
    const uid = await currentUserId(await supabaseServer());
    if (!uid) throw new HttpError(401, "เข้าสู่ระบบในฐานะครูก่อนเปิดห้องสด");
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await createLive(String(body.quizPin ?? ""), uid));
  } catch (e) {
    return fail(e);
  }
}
