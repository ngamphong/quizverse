import { NextResponse } from "next/server";
import { answerQuestion } from "@/lib/server/game";
import { fail } from "@/lib/server/http";

export const runtime = "nodejs";

/** Body: { sessionId, token, choice (-1 = timed out), conf } → graded on the server. */
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    return NextResponse.json(await answerQuestion(String(b.sessionId ?? ""), String(b.token ?? ""), Number(b.choice), String(b.conf ?? "")));
  } catch (e) {
    return fail(e);
  }
}
