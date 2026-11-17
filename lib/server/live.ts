import "server-only";
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { TIME_LIMIT } from "../constants";
import { gradeAnswer } from "../grading";
import { TEAM_NAMES, type LiveRow, type LiveState, type TeamReveal, type TeamRow } from "../liveTypes";
import { applyToProfile } from "../profile";
import { supabaseAdmin } from "../supabase/server";
import type { AnswerRecord, Conf, Question } from "../types";
import { HttpError } from "./http";
import { loadProfileRow, saveLearning } from "./profiles";
import { selectQuestions } from "./questions";
import { nudge } from "./realtime";

/**
 * Live multi-device rooms. The host's device drives the flow (start → question →
 * reveal → next … → ended); every answer is graded and timed on the server.
 * Team mode (Collaborative Challenge): members vote with a reason, see teammates'
 * reasons, may change their vote; the team answer is the majority.
 */
const GRACE_S = 2;
const MAX_PLAYERS = 80;
const MAX_QUESTIONS = 20;
const TEAM_CORRECT = 1000;
const TEAM_ALL_REASONED = 200;

interface Room {
  id: string; pin: string; quiz_id: string; host_id: string; state: LiveState["state"];
  question_ids: string[]; current_index: number; question_started_at: string | null; created_at: string;
  team_mode?: boolean;
}
interface Player { id: string; room_id: string; user_id: string | null; nickname: string; token: string; score: number; team?: number | null }
interface AnswerRow { player_id: string; question_id: string; choice: number; correct: boolean; points: number; reason?: string | null; answered_at: string }

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
  const { data } = await selectQuestions<Question>((cols) => db().from("questions").select(cols).in("id", ids).returns<Question[]>());
  return new Map((data ?? []).map((q) => [q.id as string, { ...q, qid: q.id } as Question]));
}

// ───────────── create / lookup / join ─────────────

export async function createLive(quizPin: string, hostId: string, teamMode = false) {
  const host = await loadProfileRow(hostId);
  if (host?.role !== "teacher") throw new HttpError(403, "เฉพาะบัญชีครูเท่านั้นที่เปิดห้องสดได้");
  const { data: quiz } = await db().from("quizzes").select("id, owner_id, is_sample").eq("pin", quizPin).maybeSingle();
  if (!quiz) throw new HttpError(404, "ไม่พบชุดข้อสอบนี้");
  if (!quiz.is_sample && quiz.owner_id !== hostId) throw new HttpError(403, "เปิดห้องสดได้เฉพาะชุดข้อสอบของคุณ");

  for (let i = 0; i < 8; i++) {
    const pin = String(randomInt(100000, 1000000));
    const { data: clash } = await db().from("quizzes").select("id").eq("pin", pin).maybeSingle();
    if (clash) continue; // keep live PINs distinct from solo quiz PINs
    const row = { pin, quiz_id: quiz.id, host_id: hostId, ...(teamMode ? { team_mode: true } : {}) };
    const { data, error } = await db().from("live_rooms").insert(row).select("id, pin").single();
    if (data) return { id: data.id as string, pin: data.pin as string };
    if (error?.code === "PGRST204" || error?.code === "42703") throw new HttpError(503, "ต้องรัน supabase/quest-team.sql ก่อนใช้โหมดทีม");
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
  const { data: room } = await db().from("live_rooms").select("*").eq("pin", pin).neq("state", "ended").maybeSingle();
  if (!room) throw new HttpError(404, "ไม่พบห้องสดนี้ หรือห้องปิดไปแล้ว");

  let name = nickname.trim().replace(/\s+/g, " ").slice(0, 20);
  if (userId) name = (await loadProfileRow(userId))?.display_name?.slice(0, 20) || name;
  if (!name) throw new HttpError(400, "กรุณาตั้งชื่อผู้เล่น");

  const { data: others } = await db().from("live_players").select("id, team").eq("room_id", room.id);
  if ((others?.length ?? 0) >= MAX_PLAYERS) throw new HttpError(409, `ห้องนี้เต็มแล้ว (สูงสุด ${MAX_PLAYERS} คน)`);

  // late joiner in a running team game → smallest team
  let team: number | undefined;
  if (room.team_mode && room.state !== "lobby") {
    const sizes = new Map<number, number>();
    (others ?? []).forEach((o) => o.team != null && sizes.set(o.team, (sizes.get(o.team) ?? 0) + 1));
    team = [...sizes.entries()].sort((a, b) => a[1] - b[1])[0]?.[0] ?? 0;
  }

  const token = randomBytes(24).toString("base64url");
  const { data: p, error } = await db().from("live_players")
    .insert({ room_id: room.id, user_id: userId, nickname: name, token, ...(team !== undefined ? { team } : {}) }).select("id").single();
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
  // player and their room in one round trip (this runs on every poll and every answer)
  const { data } = await db().from("live_players").select("*, room:live_rooms(*)").eq("id", playerId).maybeSingle();
  if (!data || !sameToken(String(data.token), String(token ?? ""))) throw new HttpError(404, "ไม่พบผู้เล่นนี้ เข้าห้องใหม่อีกครั้ง");
  const { room, ...player } = data as Player & { room: Room | null };
  if (!room) throw new HttpError(404, "ไม่พบห้องสดนี้");
  return { player: player as Player, room };
}

// ───────────── teams ─────────────

const teamName = (t: number) => TEAM_NAMES[t] ?? `ทีม ${t + 1}`;
const hasReason = (r?: string | null) => !!r && r.trim().length >= 3;

/** Majority vote of a team for one question (tie → the choice reached first). */
function teamDecision(votes: AnswerRow[]) {
  const counts = new Map<number, { n: number; first: number }>();
  votes.filter((v) => v.choice >= 0).forEach((v) => {
    const c = counts.get(v.choice) ?? { n: 0, first: Date.parse(v.answered_at) };
    c.n++;
    c.first = Math.min(c.first, Date.parse(v.answered_at));
    counts.set(v.choice, c);
  });
  const best = [...counts.entries()].sort((a, b) => b[1].n - a[1].n || a[1].first - b[1].first)[0];
  return best ? best[0] : null;
}

function teamScoreFor(members: Player[], votes: AnswerRow[], answer: number) {
  const choice = teamDecision(votes);
  const correct = choice === answer;
  const allReasoned = members.length > 0 && members.every((m) => votes.some((v) => v.player_id === m.id && hasReason(v.reason)));
  return { choice, correct, allReasoned, points: (correct ? TEAM_CORRECT : 0) + (allReasoned ? TEAM_ALL_REASONED : 0) };
}

async function teamBoard(room: Room, players: Player[], uptoIndex: number, viewerTeam?: number | null): Promise<TeamRow[]> {
  const teams = [...new Set(players.map((p) => p.team).filter((t): t is number => t != null))].sort();
  const qids = room.question_ids.slice(0, uptoIndex + 1);
  const score = new Map<number, number>(teams.map((t) => [t, 0]));
  if (qids.length && teams.length) {
    const [{ data: rows }, qs] = await Promise.all([
      db().from("live_answers").select("player_id, question_id, choice, correct, points, reason, answered_at").eq("room_id", room.id).in("question_id", qids),
      questionsById(qids),
    ]);
    for (const qid of qids) {
      const q = qs.get(qid);
      if (!q) continue;
      for (const t of teams) {
        const members = players.filter((p) => p.team === t);
        const votes = (rows ?? []).filter((r) => r.question_id === qid && members.some((m) => m.id === r.player_id));
        score.set(t, (score.get(t) ?? 0) + teamScoreFor(members, votes as AnswerRow[], q.answer).points);
      }
    }
  }
  return teams
    .map((t) => ({ team: t, name: teamName(t), score: score.get(t) ?? 0, members: players.filter((p) => p.team === t).map((p) => p.nickname), mine: viewerTeam === t }))
    .sort((a, b) => b.score - a.score);
}

// ───────────── state ─────────────

async function roster(roomId: string): Promise<Player[]> {
  const { data } = await db().from("live_players").select("*").eq("room_id", roomId).order("score", { ascending: false }).order("joined_at");
  return (data ?? []) as Player[];
}

/**
 * When the time (plus grace) is up, move the room to "reveal" on the server,
 * so a room never gets stuck if the host's screen is hidden, asleep or closed.
 * Conditional update: only the first caller flips it.
 */
async function autoReveal(room: Room): Promise<Room> {
  if (room.state !== "question" || !room.question_started_at) return room;
  const elapsed = (Date.now() - Date.parse(room.question_started_at)) / 1000;
  if (elapsed < TIME_LIMIT + GRACE_S) return room;
  const { data } = await db().from("live_rooms").update({ state: "reveal" })
    .eq("id", room.id).eq("state", "question").eq("current_index", room.current_index).select("id");
  if (data?.length) await nudge(room.pin, "state");
  return { ...room, state: "reveal" };
}

export async function getState(input: Room, viewer: { host: true } | { player: Player }): Promise<LiveState> {
  const room = await autoReveal(input);
  const qid = room.question_ids[room.current_index];
  const team = !!room.team_mode;
  const wantAnswers = !!qid && (room.state === "question" || room.state === "reveal");
  // everything below is independent, so fetch it in one parallel round trip
  const [players, title, answerRes, qmap] = await Promise.all([
    roster(room.id),
    quizTitle(room.quiz_id),
    wantAnswers
      ? db().from("live_answers").select("player_id, question_id, choice, correct, points, reason, answered_at").eq("room_id", room.id).eq("question_id", qid)
      : Promise.resolve({ data: [] as AnswerRow[] }),
    qid && room.state !== "lobby" && room.state !== "ended" ? questionsById([qid]) : Promise.resolve(new Map<string, Question>()),
  ]);
  const s: LiveState = {
    pin: room.pin, title, state: room.state,
    index: room.current_index, total: room.question_ids.length || 0, timeLimit: TIME_LIMIT,
    serverNow: Date.now(), startedAt: ms(room.question_started_at), playerCount: players.length, teamMode: team,
  };
  if ("host" in viewer) s.roomId = room.id;
  if (room.state === "lobby") s.players = players.map((p) => p.nickname);
  const meP = "player" in viewer ? players.find((p) => p.id === viewer.player.id) ?? viewer.player : null;

  const board = (n: number): LiveRow[] => players.slice(0, n).map((p) => ({ name: p.nickname, score: p.score, me: p.id === meP?.id }));

  const answers = (answerRes.data ?? []) as AnswerRow[];
  if (wantAnswers) s.answeredCount = answers.length;
  const q = qid ? qmap.get(qid) : undefined;
  if (q && room.state === "question") s.question = { id: q.id!, topic: q.topic, level: q.level, q: q.q, choices: q.choices, image: q.image ?? null };
  if (q && room.state === "reveal") {
    const distribution = [0, 0, 0, 0];
    answers.forEach((a) => { if (a.choice >= 0) distribution[a.choice]++; });
    s.reveal = { question: q, distribution, leaderboard: board(5) };
  }
  if (room.state === "ended") s.leaderboard = board(10);

  if (team && room.state !== "lobby") {
    const upto = room.state === "question" ? room.current_index - 1 : room.current_index;
    s.teams = await teamBoard(room, players, room.state === "ended" ? room.question_ids.length - 1 : upto, meP?.team);
    if (room.state === "reveal" && q) {
      const teams = [...new Set(players.map((p) => p.team).filter((t): t is number => t != null))].sort();
      s.teamReveal = teams.map((t): TeamReveal => {
        const members = players.filter((p) => p.team === t);
        const votes = answers.filter((a) => members.some((m) => m.id === a.player_id));
        const r = teamScoreFor(members, votes, q.answer);
        return {
          team: t, name: teamName(t), choice: r.choice, correct: r.correct, points: r.points, allReasoned: r.allReasoned,
          votes: votes.map((v) => ({ name: members.find((m) => m.id === v.player_id)?.nickname ?? "", choice: v.choice, reason: v.reason ?? "" })),
        };
      });
    }
  }

  if (meP) {
    const rank = players.findIndex((p) => p.id === meP.id) + 1;
    const mine = answers.find((a) => a.player_id === meP.id);
    s.me = {
      name: meP.nickname, score: players[rank - 1]?.score ?? meP.score, rank, answered: !!mine,
      last: room.state === "reveal" ? (mine ? { choice: mine.choice, correct: mine.correct, points: mine.points } : null) : undefined,
      team: meP.team ?? null,
    };
    if (team && room.state === "question" && meP.team != null) {
      const mates = players.filter((p) => p.team === meP.team);
      s.me.teamVotes = answers.filter((a) => mates.some((m) => m.id === a.player_id))
        .map((a) => ({ name: mates.find((m) => m.id === a.player_id)?.nickname ?? "", choice: a.choice, reason: a.reason ?? "" }));
      s.me.myChoice = mine?.choice ?? null;
      s.me.myReason = mine?.reason ?? "";
    }
    if (room.state === "ended") s.me.answers = await playerRecords(room, meP.id);
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

export async function answerLive(playerId: string, token: string, rawChoice: number, rawConf: string, rawReason?: string) {
  const { player, room } = await playerAuth(playerId, token);
  if (room.state !== "question" || !room.question_started_at) throw new HttpError(409, "ตอนนี้ยังไม่เปิดให้ตอบ");
  const qid = room.question_ids[room.current_index];
  const q = (await questionsById([qid])).get(qid);
  if (!q) throw new HttpError(409, "คำถามข้อนี้ถูกลบไปแล้ว");

  const elapsed = (Date.now() - Date.parse(room.question_started_at)) / 1000;
  if (elapsed > TIME_LIMIT + GRACE_S) throw new HttpError(409, "หมดเวลาตอบข้อนี้แล้ว");
  const choice = Number.isInteger(rawChoice) && rawChoice >= 0 && rawChoice <= 3 ? rawChoice : -1;
  const conf: Conf = choice < 0 ? "none" : ((["sure", "mid", "guess"].includes(rawConf) ? rawConf : "sure") as Conf);
  const reason = String(rawReason ?? "").trim().slice(0, 300);
  if (room.team_mode && choice >= 0 && reason.length < 3) throw new HttpError(400, "โหมดทีม: เขียนเหตุผลสั้นๆ ให้เพื่อนในทีมอ่านด้วย");
  const g = gradeAnswer(q, choice, Math.max(0, TIME_LIMIT - elapsed));
  const row = { room_id: room.id, player_id: player.id, question_id: qid, choice, confidence: conf, correct: g.correct, points: g.points, ...(room.team_mode ? { reason } : {}) };

  const { error } = await db().from("live_answers").insert(row);
  if (error?.code === "23505") {
    // team mode: members may change their vote after reading teammates' reasons
    if (!room.team_mode) throw new HttpError(409, "ตอบข้อนี้ไปแล้ว");
    const { error: upErr } = await db().from("live_answers")
      .update({ choice, confidence: conf, correct: g.correct, points: g.points, reason, answered_at: new Date().toISOString() })
      .eq("player_id", player.id).eq("question_id", qid);
    if (upErr) throw new HttpError(500, "เปลี่ยนคำตอบไม่สำเร็จ");
  } else if (error) {
    throw new HttpError(500, "ส่งคำตอบไม่สำเร็จ");
  }
  // after the reply is sent: score = sum of this player's answers (recomputed, so it can never drift),
  // then tell the room. Nobody sees scores before the reveal, so the student need not wait for this.
  after(async () => {
    const { data: sum } = await db().from("live_answers").select("points").eq("player_id", player.id);
    await db().from("live_players").update({ score: (sum ?? []).reduce((t, r) => t + r.points, 0) }).eq("id", player.id);
    await nudge(room.pin, "answered");
  });
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
    if (room.team_mode) await assignTeams(room.id);
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

/** Mixed teams of about 3 (2-4 teams), in join order round-robin. */
async function assignTeams(roomId: string) {
  const { data } = await db().from("live_players").select("id").eq("room_id", roomId).order("joined_at");
  const ids = (data ?? []).map((p) => p.id as string);
  const n = Math.max(1, Math.min(4, Math.ceil(ids.length / 3), ids.length));
  const teams = Math.max(Math.min(2, ids.length), n);
  await Promise.all(ids.map((id, i) => db().from("live_players").update({ team: i % teams }).eq("id", id)));
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
