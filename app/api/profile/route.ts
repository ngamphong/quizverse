import { NextResponse } from "next/server";
import { fail, HttpError } from "@/lib/server/http";
import { loadProfileRow, saveLearning } from "@/lib/server/profiles";
import { currentUserId, supabaseServer } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireUser() {
  const id = await currentUserId(await supabaseServer());
  if (!id) throw new HttpError(401, "ยังไม่ได้เข้าสู่ระบบ");
  return id;
}

/** Signed-in user's Learning DNA (401 for guests — they keep theirs in the browser). */
export async function GET() {
  try {
    const id = await requireUser();
    const row = await loadProfileRow(id);
    if (!row) throw new HttpError(404, "ไม่พบโปรไฟล์");
    return NextResponse.json({ profile: row.profile, role: row.role });
  } catch (e) {
    return fail(e);
  }
}

/** Saves the user's own Learning DNA after a practice round (their own data only). */
export async function PUT(req: Request) {
  try {
    const id = await requireUser();
    const p = (await req.json().catch(() => null))?.profile as Profile | undefined;
    if (!p || typeof p !== "object" || typeof p.xp !== "number" || !p.stats || !Array.isArray(p.revision)) {
      throw new HttpError(400, "ข้อมูลไม่ถูกต้อง");
    }
    await saveLearning(id, p);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
