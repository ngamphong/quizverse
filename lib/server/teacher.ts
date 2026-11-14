import "server-only";
import { randomUUID } from "node:crypto";
import { SUBJECTS } from "../constants";
import { normalizeSubject } from "../subjects";
import { currentUserId, supabaseAdmin, supabaseServer } from "../supabase/server";
import type { Question } from "../types";
import { HttpError } from "./http";
import { loadProfileRow } from "./profiles";
import { cleanImageUrl, cleanQuestion, IMAGE_BUCKET, selectQuestions } from "./questions";

const db = () => supabaseAdmin();

/** The signed-in teacher's id, or a 401/403 error. */
export async function requireTeacher(): Promise<string> {
  const uid = await currentUserId(await supabaseServer());
  if (!uid) throw new HttpError(401, "เข้าสู่ระบบในฐานะครูก่อน");
  if ((await loadProfileRow(uid))?.role !== "teacher") throw new HttpError(403, "เฉพาะบัญชีครูเท่านั้น");
  return uid;
}

async function ownQuiz(quizId: string, uid: string) {
  if (!/^[0-9a-f-]{36}$/i.test(quizId)) throw new HttpError(400, "รหัสชุดข้อสอบไม่ถูกต้อง");
  const { data } = await db().from("quizzes").select("id, pin, title, owner_id, created_at").eq("id", quizId).maybeSingle();
  if (!data || data.owner_id !== uid) throw new HttpError(404, "ไม่พบชุดข้อสอบนี้ในคลังของคุณ");
  return data as { id: string; pin: string; title: string; created_at: string };
}

// ───────────── question bank ─────────────

export async function listMyQuizzes(uid: string) {
  const { data } = await db().from("quizzes").select("id, pin, title, created_at, questions(topic)").eq("owner_id", uid).order("created_at", { ascending: false });
  const quizzes = data ?? [];
  const ids = quizzes.map((q) => q.id);
  const [{ data: solo }, { data: rooms }] = await Promise.all([
    ids.length ? db().from("game_sessions").select("quiz_id").in("quiz_id", ids).not("finished_at", "is", null) : Promise.resolve({ data: [] }),
    ids.length ? db().from("live_rooms").select("quiz_id").in("quiz_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const count = (rows: { quiz_id: string }[] | null, id: string) => (rows ?? []).filter((r) => r.quiz_id === id).length;
  return quizzes.map((z) => {
    const topics = (z.questions as { topic: string }[]).map((x) => x.topic);
    return { id: z.id, pin: z.pin, title: z.title, createdAt: z.created_at, count: topics.length, topics: [...new Set(topics)], soloPlays: count(solo, z.id), liveRooms: count(rooms, z.id) };
  });
}

export async function getQuizForEdit(quizId: string, uid: string) {
  const quiz = await ownQuiz(quizId, uid);
  const { data } = await selectQuestions<Question>((cols) => db().from("questions").select(cols).eq("quiz_id", quiz.id).order("position").returns<Question[]>());
  return { ...quiz, questions: data ?? [] };
}

/** Saves edits: updates kept questions in place (keeps their answer history), inserts new ones, deletes removed ones. */
export async function saveQuiz(quizId: string, uid: string, body: { title?: unknown; questions?: unknown }) {
  const quiz = await ownQuiz(quizId, uid);
  const title = String(body.title ?? "").trim().slice(0, 120) || quiz.title;
  const raw = Array.isArray(body.questions) ? body.questions.slice(0, 100) : [];
  const items = raw.map((x: { id?: unknown; topic?: unknown; image?: unknown }) => {
    const q = cleanQuestion(x, normalizeSubject(x?.topic) ?? SUBJECTS[0]);
    return q ? { ...q, id: typeof x.id === "string" ? x.id : undefined, image: cleanImageUrl(x.image) } : null;
  });
  if (items.some((x) => !x)) throw new HttpError(400, "มีคำถามที่ยังกรอกไม่ครบ (คำถาม + ตัวเลือก 4 ข้อที่ไม่ซ้ำกัน)");
  const qs = items as NonNullable<(typeof items)[number]>[];
  if (qs.length < 3) throw new HttpError(400, "ชุดข้อสอบต้องมีอย่างน้อย 3 ข้อ");

  const { data: existing } = await db().from("questions").select("id").eq("quiz_id", quiz.id);
  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  const keep = new Set(qs.filter((q) => q.id && existingIds.has(q.id)).map((q) => q.id!));

  await db().from("quizzes").update({ title }).eq("id", quiz.id);
  const removed = [...existingIds].filter((id) => !keep.has(id));
  if (removed.length) await db().from("questions").delete().in("id", removed);
  for (const [i, q] of qs.entries()) {
    const row = { quiz_id: quiz.id, position: i, topic: q.topic, level: q.level, q: q.q, choices: q.choices, answer: q.answer, explain: q.explain, image_url: q.image };
    const { error } = q.id && keep.has(q.id)
      ? await db().from("questions").update(row).eq("id", q.id).eq("quiz_id", quiz.id)
      : await db().from("questions").insert(row);
    if (error) throw new HttpError(500, error.code === "42703" ? "ต้องรัน supabase/teacher.sql ก่อนใช้รูปประกอบ" : "บันทึกคำถามไม่สำเร็จ");
  }
  return { ok: true, count: qs.length, removed: removed.length };
}

export async function deleteQuiz(quizId: string, uid: string) {
  const quiz = await ownQuiz(quizId, uid);
  const { error } = await db().from("quizzes").delete().eq("id", quiz.id);
  if (error) throw new HttpError(500, "ลบไม่สำเร็จ");
  return { ok: true };
}

// ───────────── images ─────────────

const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

export async function uploadImage(file: File, uid: string) {
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new HttpError(415, "รองรับรูป PNG, JPG, WEBP และ GIF");
  if (file.size > 2 * 1024 * 1024) throw new HttpError(413, "รูปใหญ่เกิน 2 MB ลองย่อรูปก่อน");
  const path = `${uid}/${randomUUID()}.${ext}`;
  const { error } = await db().storage.from(IMAGE_BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) throw new HttpError(500, /bucket/i.test(error.message) ? "ยังไม่ได้สร้างที่เก็บรูป: รัน supabase/teacher.sql ก่อน" : "อัปโหลดรูปไม่สำเร็จ");
  return { url: db().storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl };
}

// ───────────── reports & Early Alert ─────────────

interface AnswerRow { question_id: string; choice: number; correct: boolean; attempt: string; student: string }
interface Attempt { key: string; student: string; name: string; source: "เดี่ยว" | "ห้องสด"; at: string; score: number; correct: number; total: number }

/** Gathers every finished solo game and every live room answer for these quizzes. */
async function collect(quizIds: string[]) {
  const answers: AnswerRow[] = [];
  const attempts: Attempt[] = [];
  if (!quizIds.length) return { answers, attempts };
  const studentKey = (userId: string | null, name: string) => (userId ? `u:${userId}` : `g:${name.trim().toLowerCase()}`);

  const { data: sessions } = await db().from("game_sessions").select("id, user_id, nickname, score, created_at").in("quiz_id", quizIds).not("finished_at", "is", null).limit(2000);
  if (sessions?.length) {
    const { data: rows } = await db().from("answers").select("session_id, question_id, choice, correct").in("session_id", sessions.map((s) => s.id));
    for (const s of sessions) {
      const mine = (rows ?? []).filter((r) => r.session_id === s.id);
      const student = studentKey(s.user_id, s.nickname);
      mine.forEach((r) => answers.push({ question_id: r.question_id, choice: r.choice, correct: r.correct, attempt: s.id, student }));
      attempts.push({ key: s.id, student, name: s.nickname, source: "เดี่ยว", at: s.created_at, score: s.score, correct: mine.filter((r) => r.correct).length, total: mine.length });
    }
  }

  const { data: rooms } = await db().from("live_rooms").select("id, created_at").in("quiz_id", quizIds).limit(500);
  if (rooms?.length) {
    const roomIds = rooms.map((r) => r.id);
    const [{ data: players }, { data: rows }] = await Promise.all([
      db().from("live_players").select("id, room_id, user_id, nickname, score").in("room_id", roomIds),
      db().from("live_answers").select("player_id, question_id, choice, correct").in("room_id", roomIds),
    ]);
    for (const p of players ?? []) {
      const mine = (rows ?? []).filter((r) => r.player_id === p.id);
      if (!mine.length) continue;
      const student = studentKey(p.user_id, p.nickname);
      mine.forEach((r) => answers.push({ question_id: r.question_id, choice: r.choice, correct: r.correct, attempt: p.id, student }));
      const at = rooms.find((r) => r.id === p.room_id)?.created_at ?? "";
      attempts.push({ key: p.id, student, name: p.nickname, source: "ห้องสด", at, score: p.score, correct: mine.filter((r) => r.correct).length, total: mine.length });
    }
  }
  attempts.sort((a, b) => b.at.localeCompare(a.at));
  return { answers, attempts };
}

const pctOf = (c: number, n: number) => (n ? Math.round((c / n) * 100) : 0);

/** Early Alert rules — patterns over many answers, never a label from one score. */
function alertsFor(
  questions: { id: string; q: string; total: number; pct: number; topic: string }[],
  topics: { topic: string; total: number; pct: number }[],
  attempts: Attempt[],
) {
  const alerts: { kind: "question" | "topic" | "student" | "info"; text: string }[] = [];
  for (const t of topics) if (t.total >= 8 && t.pct < 50) alerts.push({ kind: "topic", text: `หัวข้อ "${t.topic}" ตอบถูกเฉลี่ย ${t.pct}% จาก ${t.total} คำตอบ ควรวางแผนสอนซ้ำ` });
  for (const q of questions) if (q.total >= 5 && q.pct < 40) alerts.push({ kind: "question", text: `ข้อ "${q.q.slice(0, 60)}" ตอบถูกเพียง ${q.pct}% (${q.total} คำตอบ) อาจเป็นจุดที่เข้าใจคลาดเคลื่อน` });

  const byStudent = new Map<string, Attempt[]>();
  attempts.forEach((a) => byStudent.set(a.student, [...(byStudent.get(a.student) ?? []), a]));
  for (const list of byStudent.values()) {
    const scored = list.filter((a) => a.total > 0).sort((a, b) => a.at.localeCompare(b.at));
    if (scored.length < 2) continue; // never flag from a single attempt
    const accs = scored.map((a) => a.correct / a.total);
    const avg = accs.reduce((s, x) => s + x, 0) / accs.length;
    const improving = accs[accs.length - 1] > accs[0] + 0.15;
    if (avg < 0.5 && !improving) alerts.push({ kind: "student", text: `${scored[0].name} ทำได้เฉลี่ย ${Math.round(avg * 100)}% จาก ${scored.length} ครั้ง และยังไม่ดีขึ้น ควรติดตามช่วยเหลือ` });
  }
  if (!alerts.length && questions.reduce((s, q) => s + q.total, 0) < 10) alerts.push({ kind: "info", text: "ข้อมูลยังน้อย ให้นักเรียนเล่นเพิ่มอีกสักหน่อย ระบบจะเริ่มแจ้งเตือนเมื่อเห็นรูปแบบที่ชัดเจน" });
  return alerts;
}

export async function quizReport(quizId: string, uid: string) {
  const quiz = await getQuizForEdit(quizId, uid);
  const { answers, attempts } = await collect([quiz.id]);
  const questions = quiz.questions.map((q) => {
    const rows = answers.filter((a) => a.question_id === q.id);
    const counts = [0, 0, 0, 0];
    let none = 0;
    rows.forEach((r) => (r.choice >= 0 ? counts[r.choice]++ : none++));
    const wrong = counts.map((n, i) => ({ i, n })).filter((x) => x.i !== q.answer && x.n > 0).sort((a, b) => b.n - a.n)[0];
    const correct = rows.filter((r) => r.correct).length;
    return { id: q.id!, q: q.q, topic: q.topic, level: q.level, choices: q.choices, answer: q.answer, counts, none, total: rows.length, pct: pctOf(correct, rows.length), commonWrong: wrong ? { choice: wrong.i, n: wrong.n } : null };
  });
  const topics = topicStats(questions);
  return {
    quiz: { id: quiz.id, pin: quiz.pin, title: quiz.title },
    summary: summary(answers, attempts),
    questions, topics, attempts: attempts.slice(0, 200),
    alerts: alertsFor(questions, topics, attempts),
  };
}

export async function overview(uid: string) {
  const quizzes = await listMyQuizzes(uid);
  const ids = quizzes.map((q) => q.id);
  const { answers, attempts } = await collect(ids);
  const qIndex = new Map<string, { q: string; topic: string }>();
  if (ids.length) {
    const { data } = await db().from("questions").select("id, q, topic").in("quiz_id", ids);
    (data ?? []).forEach((r) => qIndex.set(r.id, { q: r.q, topic: r.topic }));
  }
  const perQ = new Map<string, { c: number; n: number }>();
  answers.forEach((a) => { const s = perQ.get(a.question_id) ?? { c: 0, n: 0 }; s.n++; if (a.correct) s.c++; perQ.set(a.question_id, s); });
  const questions = [...perQ.entries()].flatMap(([id, s]) => {
    const info = qIndex.get(id);
    return info ? [{ id, q: info.q, topic: info.topic, total: s.n, pct: pctOf(s.c, s.n) }] : [];
  });
  const topics = topicStats(questions.map((q) => ({ ...q, correctCount: Math.round((q.pct * q.total) / 100) })));
  return { quizzes, summary: summary(answers, attempts), topics, alerts: alertsFor(questions, topics, attempts), recent: attempts.slice(0, 12) };
}

function topicStats(questions: { topic: string; total: number; pct: number; correctCount?: number }[]) {
  const m = new Map<string, { c: number; n: number }>();
  questions.forEach((q) => {
    const s = m.get(q.topic) ?? { c: 0, n: 0 };
    s.n += q.total;
    s.c += q.correctCount ?? Math.round((q.pct * q.total) / 100);
    m.set(q.topic, s);
  });
  return [...m.entries()].map(([topic, s]) => ({ topic, total: s.n, pct: pctOf(s.c, s.n) })).sort((a, b) => a.pct - b.pct);
}

function summary(answers: AnswerRow[], attempts: Attempt[]) {
  return {
    attempts: attempts.length,
    students: new Set(attempts.map((a) => a.student)).size,
    answers: answers.length,
    accuracy: pctOf(answers.filter((a) => a.correct).length, answers.length),
  };
}
