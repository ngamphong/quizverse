import { NextResponse } from "next/server";
import { fail, tooMany } from "@/lib/server/http";
import { stageQuestions } from "@/lib/server/quest";
import { rateLimited } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET ?subject=&stage= → 5 questions for that Learning Quest stage. */
export async function GET(req: Request) {
  if (rateLimited(req, "quest", 40)) return tooMany();
  try {
    const sp = new URL(req.url).searchParams;
    return NextResponse.json({ questions: await stageQuestions(sp.get("subject") ?? "", Number(sp.get("stage"))) });
  } catch (e) {
    return fail(e);
  }
}
