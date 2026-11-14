import { NextResponse } from "next/server";
import { featuredQuizzes } from "@/lib/server/featured";
import { fail } from "@/lib/server/http";

export const runtime = "nodejs";
export const revalidate = 60; // the home page list may be up to a minute old

/** Public: featured quizzes for the home page (sample + quizzes teachers chose to share). */
export async function GET() {
  try {
    return NextResponse.json({ quizzes: await featuredQuizzes() }, { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (e) {
    return fail(e);
  }
}
