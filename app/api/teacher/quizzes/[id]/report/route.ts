import { NextResponse } from "next/server";
import { fail } from "@/lib/server/http";
import { quizReport, requireTeacher } from "@/lib/server/teacher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Results for one quiz: per-question stats, topics, every attempt, Early Alerts. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json(await quizReport((await params).id, await requireTeacher()));
  } catch (e) {
    return fail(e);
  }
}
