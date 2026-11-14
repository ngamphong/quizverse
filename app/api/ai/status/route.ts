import { NextResponse } from "next/server";
import { aiConfigured } from "@/lib/server/gemini";

export const dynamic = "force-dynamic";

/** Lets the pages know whether AI buttons should be enabled. */
export function GET() {
  return NextResponse.json({ ready: aiConfigured() });
}
