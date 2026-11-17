import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { adjustLevel, pickQuestion } from "../adaptive";
import { ROUNDS, TIME_LIMIT } from "../constants";
import { gradeAnswer } from "../grading";
import { applyToProfile } from "../profile";
import { supabaseAdmin } from "../supabase/server";
import type { AnswerRecord, ClientQuestion, Conf, GameResult, Player, Question } from "../types";
import { HttpError } from "./http";
import { loadProfileRow, saveLearning } from "./profiles";
import { selectQuestions } from "./questions";

/**
 * Server-authoritative game engine. The browser never sees the answer key
 * before it answers, and the server measures the time itself.
 */
const GRACE_S = 2; // network allowance after the 20 s limit

interface Session {
  id: string; token: string; quiz_id: string; user_id: string | null; nickname: string;
  total: number; level: number; prev_level: number; streak: number; max_level: number; score: number;
  asked: string[]; current_question: string | null; current_started_at: string | null; current_answered: boolean;
  finished_at: string | null; result: GameResult | null;
}

const toClient = (q: Question): ClientQuestion => ({ id: q.id!, topic: q.topic, level: q.level, q: q.q, choices: q.choices, image: q.image ?? null });

async function loadPool(quizId: string): Promise<Question[]> {
  const { data, error } = await selectQuestions<Question>((cols) =>
    supabaseAdmin().from("questions").select(cols).eq("quiz_id", quizId).order("position").returns<Question[]>());
  if (error) throw new HttpError(500, "โหลดคำถามไม่สำเร็จ");
  return (data ?? []).map((r) => ({ ...r, qid: r.id }) as Question);
}

/** Just the question being answered (cheaper than the whole pool). */
async function loadQuestion(quizId: string, id: string): Promise<Question | null> {
  const { data } = await selectQuestions<Question>((cols) =>
    supabaseAdmin().from("questions").select(cols).eq("quiz_id", quizId).eq("id", id).limit(1).returns<Question[]>());
  const r = data?.[0];
  return r ? ({ ...r, qid: r.id } as Question) : null;
}

async function loadSession(id: string, token: string): Promise<Session> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "รหัสเกมไม่ถูกต้อง");
  const { data } = await supabaseAdmin().from("game_sessions").select("*").eq("id", id).maybeSingle();
  const a = Buffer.from(String(data?.token ?? "")), b = Buffer.from(String(token ?? ""));
  if (!data || a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(404, "ไม่พบเกมนี้ หรือเกมหมดอายุแล้ว");
  return data as Session;
}

export async function startGame(pin: string, nickname: string, userId: string | null) {
  if (!/^\d{6}$/.test(pin)) throw new HttpError(400, "รหัสห้องต้องเป็นตัวเลข 6 หลัก");
  const db = supabaseAdmin();
  const { data: quiz } = await db.from("quizzes").select("id, title, pin").eq("pin", pin).maybeSingle();
  if (!quiz) throw new HttpError(404, "ไม่พบห้องนี้ ตรวจสอบ PIN กับผู้สอนอีกครั้ง");

  let name = nickname.trim().slice(0, 20);
  if (userId) name = (await loadProfileRow(userId))?.display_name?.slice(0, 20) || name;
  if (!name) throw new HttpError(400, "กรุณาตั้งชื่อผู้เล่น");

  const pool = await loadPool(quiz.id);
  if (!pool.length) throw new HttpError(409, "ห้องนี้ยังไม่มีคำถาม");
  const total = Math.min(ROUNDS, pool.length);
  const first = pickQuestion(pool, [], 2, false);
  const token = randomBytes(24).toString("base64url");

  const { data: s, error } = await db.from("game_sessions").insert({
    token, quiz_id: quiz.id, user_id: userId, nickname: name, total, level: 2, prev_level: 2, max_level: first.level,
    asked: [first.id], current_question: first.id, current_started_at: new Date().toISOString(), current_answered: false,
  }).select("id").single();
  if (error || !s) throw new HttpError(500, "สร้างเกมไม่สำเร็จ");

  return { sessionId: s.id as string, token, title: quiz.title as string, pin: quiz.pin as string, total, index: 1, timeLimit: TIME_LIMIT, score: 0, question: toClient(first) };
}

export async function answerQuestion(id: string, token: string, rawChoice: number, rawConf: string, timing: string[] = []) {
  let t = performance.now();
  const lap = (name: string) => { const n = performance.now(); timing.push(`${name};dur=${(n - t).toFixed(0)}`); t = n; };
  const s = await loadSession(id, token);
  lap("session");
  if (s.finished_at) throw new HttpError(409, "เกมนี้จบแล้ว");
  if (s.current_answered || !s.current_question || !s.current_started_at) throw new HttpError(409, "ตอบข้อนี้ไปแล้ว");
  const q = await loadQuestion(s.quiz_id, s.current_question);
  if (!q) throw new HttpError(409, "คำถามข้อนี้ถูกลบไปแล้ว");
  lap("question");

  const elapsed = (Date.now() - Date.parse(s.current_started_at)) / 1000;
  let choice = Number.isInteger(rawChoice) && rawChoice >= 0 && rawChoice <= 3 ? rawChoice : -1;
  if (elapsed > TIME_LIMIT + GRACE_S) choice = -1; // answered after time ran out
  const timeLeft = Math.max(0, TIME_LIMIT - elapsed);
  const conf: Conf = choice < 0 ? "none" : (["sure", "mid", "guess"].includes(rawConf) ? rawConf : "sure") as Conf;
  const g = gradeAnswer(q, choice, timeLeft);
  const adj = adjustLevel(s.level, s.streak, g.correct);

  const db = supabaseAdmin();
  // only the first answer for this question counts (guards against double clicks / replays)
  const { data: upd } = await db.from("game_sessions")
    .update({ current_answered: true, score: s.score + g.points, level: adj.level, prev_level: s.level, streak: adj.streak })
    .eq("id", s.id).eq("current_answered", false).select("id");
  if (!upd?.length) throw new HttpError(409, "ตอบข้อนี้ไปแล้ว");
  lap("update");
  await db.from("answers").insert({ session_id: s.id, question_id: q.id, choice, confidence: conf, correct: g.correct, points: g.points });
  lap("insert");

  return {
    correct: g.correct, choice, answer: q.answer, explain: q.explain, points: g.points, score: s.score + g.points,
    level: adj.level, prevLevel: s.level, done: s.asked.length >= s.total,
    question: { ...q }, // full question (with key) is fine now that it has been answered
  };
}

export async function nextQuestion(id: string, token: string) {
  const s = await loadSession(id, token);
  if (s.finished_at && s.result) return { done: true as const, result: s.result };
  if (!s.current_answered) throw new HttpError(409, "ยังไม่ได้ตอบข้อปัจจุบัน");
  if (s.asked.length >= s.total) return { done: true as const, result: await finish(s) };

  const pool = await loadPool(s.quiz_id);
  const asked = s.asked.map((qid) => pool.find((p) => p.id === qid)).filter(Boolean) as Question[];
  const q = pickQuestion(pool, asked, s.level, false);
  if (!q) return { done: true as const, result: await finish(s) };

  const { data: upd } = await supabaseAdmin().from("game_sessions").update({
    asked: [...s.asked, q.id], current_question: q.id, current_started_at: new Date().toISOString(),
    current_answered: false, max_level: Math.max(s.max_level, q.level),
  }).eq("id", s.id).eq("current_answered", true).eq("current_question", s.current_question).select("id");
  if (!upd?.length) throw new HttpError(409, "มีการเปลี่ยนข้อไปแล้ว ลองรีเฟรชหน้า");

  return { done: false as const, index: s.asked.length + 1, total: s.total, score: s.score, question: toClient(q) };
}

const TOP_N = 10;

/**
 * Real leaderboard for a quiz: each other student's best finished solo score
 * (logged-in players by account, guests by nickname), plus this game.
 */
async function leaderboard(s: Session): Promise<{ players: Player[]; playerCount: number }> {
  const { data } = await supabaseAdmin().from("game_sessions")
    .select("user_id, nickname, score")
    .eq("quiz_id", s.quiz_id).not("finished_at", "is", null).neq("id", s.id)
    .order("score", { ascending: false }).limit(1000);

  const best = new Map<string, Player>();
  for (const r of data ?? []) {
    if (s.user_id && r.user_id === s.user_id) continue; // your own earlier runs
    const key = r.user_id ? `u:${r.user_id}` : `n:${String(r.nickname).trim().toLowerCase()}`;
    if (!best.has(key)) best.set(key, { name: r.nickname, score: r.score }); // rows are sorted, first is best
  }
  const all: Player[] = [...best.values(), { name: s.nickname, score: s.score, me: true }]
    .sort((a, b) => b.score - a.score || (a.me ? -1 : b.me ? 1 : 0)); // ties go to you
  const myRank = all.findIndex((p) => p.me) + 1;
  const players = all.slice(0, TOP_N);
  if (myRank > TOP_N) players.push({ ...all[myRank - 1], rank: myRank });
  return { players, playerCount: all.length };
}

async function finish(s: Session): Promise<GameResult> {
  const db = supabaseAdmin();
  const pool = await loadPool(s.quiz_id);
  const { data: rows } = await db.from("answers").select("question_id, choice, confidence, correct, points").eq("session_id", s.id).order("id");
  const answers: AnswerRecord[] = (rows ?? []).flatMap((r) => {
    const q = pool.find((p) => p.id === r.question_id);
    return q ? [{ q, choice: r.choice, correct: r.correct, points: r.points, conf: r.confidence as Conf }] : [];
  });

  const { players, playerCount } = await leaderboard(s);
  const result: GameResult = { name: s.nickname, score: s.score, total: s.total, maxLevel: s.max_level, answers, players, playerCount };

  // finish exactly once; only the call that flips finished_at updates Learning DNA
  const { data: upd } = await db.from("game_sessions")
    .update({ finished_at: new Date().toISOString(), result }).eq("id", s.id).is("finished_at", null).select("id");
  if (!upd?.length) {
    const { data } = await db.from("game_sessions").select("result").eq("id", s.id).single();
    return (data?.result as GameResult) ?? result;
  }
  if (s.user_id) {
    const row = await loadProfileRow(s.user_id);
    if (row) await saveLearning(s.user_id, applyToProfile(row.profile, answers, false));
  }
  return result;
}
