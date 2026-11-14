import "server-only";
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { TIME_LIMIT } from "../constants";
import { gradeAnswer } from "../grading";
import type { LiveRow, LiveState } from "../liveTypes";
import { applyToProfile } from "../profile";
import { supabaseAdmin } from "../supabase/server";
import type { AnswerRecord, Conf, Question } from "../types";
import { HttpError } from "./http";
import { loadProfileRow, saveLearning } from "./profiles";
import { nudge } from "./realtime";

/**
 * Live multi-device rooms. The host's device drives the flow (start → question →
 * reveal → next … → ended); every answer is graded and timed on the server.
 */
const GRACE_S = 2;
const MAX_PLAYERS = 80;
const MAX_QUESTIONS = 20;

interface Room {
  id: string; pin: string; quiz_id: string; host_id: string; state: LiveState["state"];
  question_ids: string[]; current_index: number; question_started_at: string | null; created_at: string;
}
interface Player { id: string; room_id: string; user_id: string | null; nickname: string; token: string; score: number }

const db = () => supabaseAdmin();
const ms = (t: string | null) => (t ? Date.parse(t) : null);

function sameToken(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function quizTitle(quizId: string) {
  const { data } = await db().from("quizzes").select("title").eq("id", quizId).single();
  return (data?.title as string) ?? "";
}

async function questionsById(ids: string[]): Promise<Map<string, Question>> {
  if (!ids.length) return new Map();
  const { data } = await db().from("questions").select("id, topic, level, q, choices, answer, explain").in("id", ids);
  return new Map((data ?? []).map((q) => [q.id as string, { ...q, qid: q.id } as Question]));
}

// ───────────── create / lookup / join ─────────────

export async function createLive(quizPin: string, hostId: string) {
  const host = await loadProfileRow(hostId);
  if (host?.role !== "teacher") throw new HttpError(403, "เฉพาะบัญชีครูเท่านั้นที่เปิดห้องสดได้");
  const { data: quiz } = await db().from("quizzes").select("id, owner_id, is_sample").eq("pin", quizPin).maybeSingle();
  if (!quiz) throw new HttpError(404, "ไม่พบชุดข้อสอบนี้");
  if (!quiz.is_sample && quiz.owner_id !== hostId) throw new HttpError(403, "เปิดห้องสดได้เฉพาะชุดข้อสอบของคุณ");

  for (let i = 0; i < 8; i++) {
    const pin = String(randomInt(100000, 1000000));
    const { data: clash } = await db().from("quizzes").select("id").eq("pin", pin).maybeSingle();
    if (clash) continue; // keep live PINs distinct from solo quiz PINs
    const { data, error } = await db().from("live_rooms").insert({ pin, quiz_id: quiz.id, host_id: hostId }).select("id, pin").single();
    if (data) return { id: data.id as string, pin: data.pin as string };
    if (error && error.code !== "23505") throw new HttpError(500, "เปิดห้องสดไม่สำเร็จ");
  }
  throw new HttpError(500, "สร้าง PIN ไม่สำเร็จ ลองใหม่อีกครั้ง");
}

/** Is this PIN a running live room? (Join page uses it to pick live vs solo.) */
export async function isLivePin(pin: string) {
  const { data } = await db().from("live_rooms").select("id").eq("pin", pin).neq("state", "ended").maybeSingle();
  return !!data;
}

export async function joinLive(pin: string, nickname: string, userId: string | null) {
  if (!/^\d{6}$/.test(pin)) throw new HttpError(400, "รหัสห้องต้องเป็นตัวเลข 6 หลัก");
  const { data: room } = await db().from("live_rooms").select("id, pin, state").eq("pin", pin).neq("state", "ended").maybeSingle();
  if (!room) throw new HttpError(404, "ไม่พบห้องสดนี้ หรือห้องปิดไปแล้ว");

  let name = nickname.trim().replace(/\s+/g, " ").slice(0, 20);
  if (userId) name = (await loadProfileRow(userId))?.display_name?.slice(0, 20) || name;
  if (!name) throw new HttpError(400, "กรุณาตั้งชื่อผู้เล่น");

  const { count } = await db().from("live_players").select("id", { count: "exact", head: true }).eq("room_id", room.id);
  if ((count ?? 0) >= MAX_PLAYERS) throw new HttpError(409, `ห้องนี้เต็มแล้ว (สูงสุด ${MAX_PLAYERS} คน)`);

  const token = randomBytes(24).toString("base64url");
  const { data: p, error } = await db().from("live_players").insert({ room_id: room.id, user_id: userId, nickname: name, token }).select("id").single();
  if (error?.code === "23505") throw new HttpError(409, "ชื่อนี้มีคนใช้ในห้องแล้ว ลองชื่ออื่น");
  if (error || !p) throw new HttpError(500, "เข้าห้องไม่สำเร็จ");
  await nudge(room.pin, "players");
  return { playerId: p.id as string, token, pin: room.pin as string };
}

// ───────────── auth helpers ─────────────

async function roomById(id: string): Promise<Room> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "รหัสห้องไม่ถูกต้อง");
  const { data } = await db().from("live_rooms").select("*").eq("id", id).maybeSingle();
  if (!data) throw new HttpError(404, "ไม่พบห้องสดนี้");
  return data as Room;
}

export async function hostRoom(roomId: string, userId: string | null): Promise<Room> {
  const room = await roomById(roomId);
  if (!userId || room.host_id !== userId) throw new HttpError(403, "เฉพาะครูที่เปิดห้องนี้เท่านั้น");
  return room;
}

export async function playerAuth(playerId: string, token: string): Promise<{ player: Player; room: Room }> {
  if (!/^[0-9a-f-]{36}$/i.test(playerId)) throw new HttpError(400, "ข้อมูลผู้เล่นไม่ถูกต้อง");
  const { data } = await db().from("live_players").select("*").eq("id", playerId).maybeSingle();
  if (!data || !sameToken(String(data.token), String(token ?? ""))) throw new HttpError(404, "ไม่พบผู้เล่นนี้ เข้าห้องใหม่อีกครั้ง");
  return { player: data as Player, room: await roomById(data.room_id) };
}

// ───────────── state ─────────────

async function ranking(roomId: string) {
  const { data } = await db().from("live_players").select("id, nickname, score, joined_at").eq("room_id", roomId).order("score", { ascending: false }).order("joined_at");
  return (data ?? []) as { id: string; nickname: string; score: number }[];
}

export async function getState(room: Room, viewer: { host: true } | { player: Player }): Promise<LiveState> {
  const players = await ranking(room.id);
  const qid = room.question_ids[room.current_index];
  const s: LiveState = {
    pin: room.pin, title: await quizTitle(room.quiz_id), state: room.state,
    index: room.current_index, total: room.question_ids.length || 0, timeLimit: TIME_LIMIT,
    serverNow: Date.now(), startedAt: ms(room.question_started_at), playerCount: players.length,
  };
  if ("host" in viewer) s.roomId = room.id;
  if (room.state === "lobby") s.players = players.map((p) => p.nickname);

  const board = (n: number): LiveRow[] =>
    players.slice(0, n).map((p) => ({ name: p.nickname, score: p.score, me: "player" in viewer && p.id === viewer.player.id }));

  let answers: { player_id: string; choice: number; correct: boolean; points: number }[] = [];
  if (qid && (room.state === "question" || room.state === "reveal")) {
    const { data } = await db().from("live_answers").select("player_id, choice, correct, points").eq("room_id", room.id).eq("question_id", qid);
    answers = data ?? [];
    s.answeredCount = answers.length;
  }
  const qmap = qid ? await questionsById([qid]) : new Map<string, Question>();
  const q = qid ? qmap.get(qid) : undefined;
  if (q && room.state === "question") s.question = { id: q.id!, topic: q.topic, level: q.level, q: q.q, choices: q.choices };
  if (q && room.state === "reveal") {
    const distribution = [0, 0, 0, 0];
    answers.forEach((a) => { if (a.choice >= 0) distribution[a.choice]++; });
    s.reveal = { question: q, distribution, leaderboard: board(5) };
  }
  if (room.state === "ended") s.leaderboard = board(10);

  if ("player" in viewer) {
    const me = viewer.player;
    const rank = players.findIndex((p) => p.id === me.id) + 1;
    const mine = answers.find((a) => a.player_id === me.id);
    s.me = { name: me.nickname, score: players[rank - 1]?.score ?? me.score, rank, answered: !!mine, last: room.state === "reveal" ? mine ?? null : undefined };
    if (room.state === "ended") s.me.answers = (await playerRecords(room, me.id)).map((a) => ({ ...a, conf: a.conf }));
  }
  return s;
}

async function playerRecords(room: Room, playerId: string): Promise<AnswerRecord[]> {
  const { data } = await db().from("live_answers").select("question_id, choice, confidence, correct, points").eq("player_id", playerId).order("id");
  const qs = await questionsById(room.question_ids);
  return (data ?? []).flatMap((r) => {
    const q = qs.get(r.question_id);
    return q ? [{ q, choice: r.choice, correct: r.correct, points: r.points, conf: r.confidence as Conf }] : [];
  });
}

// ───────────── answering ─────────────

export async function answerLive(playerId: string, token: string, rawChoice: number, rawConf: string) {
  const { player, room } = await playerAuth(playerId, token);
  if (room.state !== "question" || !room.question_started_at) throw new HttpError(409, "ตอนนี้ยังไม่เปิดให้ตอบ");
  const qid = room.question_ids[room.current_index];
  const q = (await questionsById([qid])).get(qid);
  if (!q) throw new HttpError(409, "คำถามข้อนี้ถูกลบไปแล้ว");

  const elapsed = (Date.now() - Date.parse(room.question_started_at)) / 1000;
  if (elapsed > TIME_LIMIT + GRACE_S) throw new HttpError(409, "หมดเวลาตอบข้อนี้แล้ว");
  const choice = Number.isInteger(rawChoice) && rawChoice >= 0 && rawChoice <= 3 ? rawChoice : -1;
  const conf: Conf = choice < 0 ? "none" : ((["sure", "mid", "guess"].includes(rawConf) ? rawConf : "sure") as Conf);
  const g = gradeAnswer(q, choice, Math.max(0, TIME_LIMIT - elapsed));

  const { error } = await db().from("live_answers").insert({ room_id: room.id, player_id: player.id, question_id: qid, choice, confidence: conf, correct: g.correct, points: g.points });
  if (error?.code === "23505") throw new HttpError(409, "ตอบข้อนี้ไปแล้ว");
  if (error) throw new HttpError(500, "ส่งคำตอบไม่สำเร็จ");
  if (g.points) {
    // score = sum of this player's answers (recomputed, so it can never drift)
    const { data: sum } = await db().from("live_answers").select("points").eq("player_id", player.id);
    await db().from("live_players").update({ score: (sum ?? []).reduce((t, r) => t + r.points, 0) }).eq("id", player.id);
  }
  await nudge(room.pin, "answered");
  return { ok: true }; // correctness stays hidden until the host reveals
}

// ───────────── host controls ─────────────

export async function control(room: Room, action: string) {
  const now = new Date().toISOString();
  const move = async (from: LiveState["state"][], patch: Record<string, unknown>) => {
    const { data } = await db().from("live_rooms").update(patch).eq("id", room.id).in("state", from).eq("current_index", room.current_index).select("id");
    if (!data?.length) throw new HttpError(409, "สถานะห้องเปลี่ยนไปแล้ว ลองรีเฟรช");
  };

  if (action === "start") {
    if (room.state !== "lobby") throw new HttpError(409, "เกมเริ่มไปแล้ว");
    const { data: qs } = await db().from("questions").select("id").eq("quiz_id", room.quiz_id).order("position").limit(MAX_QUESTIONS);
    if (!qs?.length) throw new HttpError(409, "ชุดข้อสอบนี้ไม่มีคำถาม");
    await move(["lobby"], { state: "question", question_ids: qs.map((q) => q.id), current_index: 0, question_started_at: now });
  } else if (action === "reveal") {
    if (room.state !== "question") throw new HttpError(409, "ยังไม่อยู่ในช่วงตอบคำถาม");
    await move(["question"], { state: "reveal" });
  } else if (action === "next") {
    if (room.state !== "reveal") throw new HttpError(409, "ต้องเฉลยข้อนี้ก่อน");
    if (room.current_index + 1 >= room.question_ids.length) return control(room, "end");
    await move(["reveal"], { state: "question", current_index: room.current_index + 1, question_started_at: now });
  } else if (action === "end") {
    if (room.state === "ended") return;
    await move(["lobby", "question", "reveal"], { state: "ended", ended_at: now });
    await updateLearningDna(room);
  } else {
    throw new HttpError(400, "คำสั่งไม่ถูกต้อง");
  }
  await nudge(room.pin, "state");
}

/** At the end, fold each signed-in player's answers into their Learning DNA (guests do it in their browser). */
async function updateLearningDna(room: Room) {
  const { data: ps } = await db().from("live_players").select("id, user_id").eq("room_id", room.id).not("user_id", "is", null);
  for (const p of ps ?? []) {
    try {
      const records = await playerRecords(room, p.id);
      const row = records.length ? await loadProfileRow(p.user_id) : null;
      if (row) await saveLearning(p.user_id, applyToProfile(row.profile, records, false));
    } catch (e) {
      console.error("[live] DNA update failed for player", p.id, e);
    }
  }
}
