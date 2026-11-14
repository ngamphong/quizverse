import { NextResponse } from "next/server";
import { fail } from "@/lib/server/http";
import { overview, requireTeacher } from "@/lib/server/teacher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Teacher dashboard: all my quizzes, overall results, weak topics and Early Alerts. */
export async function GET() {
  try {
    return NextResponse.json(await overview(await requireTeacher()));
  } catch (e) {
    return fail(e);
  }
}
