import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { fail, HttpError, tooMany } from "@/lib/server/http";
import { cleanImageUrl, cleanQuestion } from "@/lib/server/questions";
import { rateLimited } from "@/lib/server/rateLimit";
import { currentUserId, supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { SUBJECTS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Room { pin: string; title: string; count: number; topics: string[]; sample: boolean }

/** Rooms shown on the join page: the sample room, plus the teacher's own rooms when signed in. */
export async function GET() {
  try {
    const sb = await supabaseServer();
    const uid = await currentUserId(sb);
    const db = supabaseAdmin();
    let q = db.from("quizzes").select("id, pin, title, is_sample, created_at, questions(topic)").order("created_at", { ascending: false });
    q = uid ? q.or(`is_sample.eq.true,owner_id.eq.${uid}`) : q.eq("is_sample", true);
    const { data, error } = await q;
    if (error) throw new HttpError(500, "โหลดรายชื่อห้องไม่สำเร็จ");
    const rooms: Room[] = (data ?? []).map((z) => {
      const topics = (z.questions as { topic: string }[]).map((x) => x.topic);
      return { pin: z.pin, title: z.title, count: topics.length, topics: [...new Set(topics)], sample: z.is_sample };
    });
    rooms.sort((a, b) => Number(a.sample) - Number(b.sample) || 0);
    return NextResponse.json({ rooms, signedIn: !!uid });
  } catch (e) {
    return fail(e);
  }
}

/** Teacher publishes approved questions → new room with a unique 6-digit PIN. */
export async function POST(req: Request) {
  if (rateLimited(req, "publish", 20)) return tooMany();
  try {
    const sb = await supabaseServer();
    const uid = await currentUserId(sb);
    if (!uid) throw new HttpError(401, "เข้าสู่ระบบในฐานะครูก่อนเผยแพร่ข้อสอบ");
    const { data: prof } = await sb.from("profiles").select("role").eq("id", uid).maybeSingle();
    if (prof?.role !== "teacher") throw new HttpError(403, "เฉพาะบัญชีครูเท่านั้นที่เผยแพร่ข้อสอบได้");

    const body = await req.json().catch(() => ({}));
    const title = String(body.title ?? "").trim().slice(0, 120) || "แบบทดสอบใหม่";
    const list = Array.isArray(body.questions) ? body.questions.slice(0, 100) : [];
    const questions = list
      .map((x: { topic?: string; image?: unknown }) => {
        const q = cleanQuestion(x, SUBJECTS.includes(String(x?.topic)) ? String(x.topic) : SUBJECTS[0]);
        return q ? { ...q, image: cleanImageUrl(x.image) } : null;
      })
      .filter(Boolean);
    if (questions.length < 3) throw new HttpError(400, "ต้องมีคำถามที่สมบูรณ์อย่างน้อย 3 ข้อ");

    // insert as the teacher, so Row Level Security checks ownership and role
    let quiz: { id: string; pin: string } | null = null;
    for (let i = 0; i < 6 && !quiz; i++) {
      const pin = String(randomInt(100000, 1000000));
      const { data, error } = await sb.from("quizzes").insert({ pin, title, owner_id: uid }).select("id, pin").single();
      if (data) quiz = data;
      else if (error && error.code !== "23505") throw new HttpError(500, "สร้างห้องไม่สำเร็จ"); // 23505 = PIN taken, retry
    }
    if (!quiz) throw new HttpError(500, "สร้าง PIN ไม่สำเร็จ ลองใหม่อีกครั้ง");

    const { error: qErr } = await sb.from("questions").insert(
      questions.map((q: NonNullable<ReturnType<typeof cleanQuestion>>, i: number) => ({
        quiz_id: quiz!.id, position: i, topic: q.topic, level: q.level, q: q.q, choices: q.choices, answer: q.answer, explain: q.explain,
        ...(q.image ? { image_url: q.image } : {}), // only send the column when used, so publishing works before teacher.sql
      })),
    );
    if (qErr) {
      await sb.from("quizzes").delete().eq("id", quiz.id);
      throw new HttpError(500, "บันทึกคำถามไม่สำเร็จ");
    }
    return NextResponse.json({ pin: quiz.pin, count: questions.length });
  } catch (e) {
    return fail(e);
  }
}
