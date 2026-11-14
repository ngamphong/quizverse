import { NextResponse } from "next/server";
import { nextQuestion } from "@/lib/server/game";
import { fail } from "@/lib/server/http";

export const runtime = "nodejs";

/** Body: { sessionId, token } → next question, or the final result when the game is over. */
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    return NextResponse.json(await nextQuestion(String(b.sessionId ?? ""), String(b.token ?? "")));
  } catch (e) {
    return fail(e);
  }
}
