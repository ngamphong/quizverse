import { NextResponse } from "next/server";
import { fail } from "@/lib/server/http";
import { deleteQuiz, getQuizForEdit, requireTeacher, saveQuiz } from "@/lib/server/teacher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** One of my quizzes, with answer keys, for the editor. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    return NextResponse.json(await getQuizForEdit((await params).id, await requireTeacher()));
  } catch (e) {
    return fail(e);
  }
}

/** Save title + questions (kept questions keep their answer history). */
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const uid = await requireTeacher();
    return NextResponse.json(await saveQuiz((await params).id, uid, await req.json().catch(() => ({}))));
  } catch (e) {
    return fail(e);
  }
}

/** Delete the quiz and all of its results. */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    return NextResponse.json(await deleteQuiz((await params).id, await requireTeacher()));
  } catch (e) {
    return fail(e);
  }
}
