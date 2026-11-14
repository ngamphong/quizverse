import { NextResponse } from "next/server";
import { fail } from "@/lib/server/http";
import { answerLive } from "@/lib/server/live";

export const runtime = "nodejs";

/** POST { pid, token, choice, conf } → graded and timed on the server; result shown at reveal. */
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    return NextResponse.json(await answerLive(String(b.pid ?? ""), String(b.token ?? ""), Number(b.choice), String(b.conf ?? "")));
  } catch (e) {
    return fail(e);
  }
}
