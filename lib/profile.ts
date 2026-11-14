import { DAY, INTERVALS, SUBJECTS } from "./constants";
import { SAMPLE_QUIZ } from "./sampleQuiz";
import type { AnswerRecord, Profile, RevisionItem } from "./types";

export const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
export const pct = (s?: { right: number; total: number }) => (s && s.total ? Math.round((s.right / s.total) * 100) : 0);
export const XP_PER_LEVEL = 300;
export const lvOf = (xp: number) => Math.floor(xp / XP_PER_LEVEL) + 1;

/** Example profile shown on first visit, clearly marked as an example in the UI. */
export function exampleProfile(): Profile {
  const now = Date.now();
  const rq = (i: number) => ({ ...SAMPLE_QUIZ.questions[i], qid: SAMPLE_QUIZ.questions[i].q });
  return {
    example: true, name: "Student01", xp: 3240, games: 12, streak: 7, lastDay: dayKey(now),
    stats: {
      "วิทยาศาสตร์": { right: 23, total: 25, hist: [80, 88, 92] },
      "คณิตศาสตร์": { right: 15, total: 24, hist: [40, 55, 63] },
      "ภาษาอังกฤษ": { right: 22, total: 25, hist: [84, 86, 88] },
      "ภาษาไทย": { right: 18, total: 25, hist: [70, 68, 72] },
      "สังคมศึกษา": { right: 17, total: 25, hist: [60, 66, 68] },
    },
    conf: { sureWrong: 3, guessRight: 5 },
    revision: [
      { ...rq(5), step: 0, due: now - DAY / 2, reason: "ตอบผิด" },
      { ...rq(4), step: 1, due: now + 2 * DAY, reason: "ตอบผิด" },
      { ...rq(14), step: 0, due: now + DAY, reason: "ตอบถูกแต่เดา" },
    ],
    mastered: 4, bestJump: 23,
  };
}

export function emptyProfile(name?: string): Profile {
  const stats: Profile["stats"] = {};
  SUBJECTS.forEach((s) => (stats[s] = { right: 0, total: 0, hist: [] }));
  return { example: false, name: name || "Student01", xp: 0, games: 0, streak: 0, lastDay: null, stats, conf: { sureWrong: 0, guessRight: 0 }, revision: [], mastered: 0, bestJump: 0 };
}

/** Folds one finished game (or practice round) into the learning profile. Returns a new object. */
export function applyToProfile(input: Profile, answers: AnswerRecord[], practice: boolean): Profile {
  const p: Profile = structuredClone(input);
  const now = Date.now();
  const before: Record<string, number> = {};
  SUBJECTS.forEach((s) => (before[s] = pct(p.stats[s])));
  const gameTopic: Record<string, { r: number; n: number }> = {};

  answers.forEach((a) => {
    const t = a.q.topic;
    p.stats[t] ||= { right: 0, total: 0, hist: [] };
    p.stats[t].total++;
    if (a.correct) p.stats[t].right++;
    gameTopic[t] ||= { r: 0, n: 0 };
    gameTopic[t].n++;
    if (a.correct) gameTopic[t].r++;
    if (a.conf === "sure" && !a.correct) p.conf.sureWrong++;
    if (a.conf === "guess" && a.correct) p.conf.guessRight++;

    const qid = a.q.qid || a.q.q;
    const idx = p.revision.findIndex((r) => r.qid === qid);
    const needs = !a.correct || a.conf === "guess";
    if (practice && idx >= 0) {
      const r = p.revision[idx];
      if (needs) { r.step = 0; r.due = now + DAY; }
      else {
        r.step++;
        if (r.step >= INTERVALS.length) { p.revision.splice(idx, 1); p.mastered++; }
        else r.due = now + INTERVALS[r.step] * DAY;
      }
    } else if (needs) {
      const { topic, level, q, choices, answer, explain } = a.q;
      const item: RevisionItem = { topic, level, q, choices, answer, explain, qid, step: 0, due: now + DAY, reason: a.correct ? "ตอบถูกแต่เดา" : "ตอบผิด" };
      if (idx >= 0) p.revision[idx] = item; else p.revision.push(item);
    }
  });

  Object.entries(gameTopic).forEach(([t, v]) => {
    const h = p.stats[t].hist;
    h.push(Math.round((v.r / v.n) * 100));
    if (h.length > 10) h.shift();
  });
  SUBJECTS.forEach((s) => {
    const jump = pct(p.stats[s]) - before[s];
    if (before[s] > 0 && jump > p.bestJump) p.bestJump = jump;
  });

  const right = answers.filter((a) => a.correct).length;
  p.xp += right * 10 + (practice ? 5 : 20);
  if (!practice) p.games++;
  const today = dayKey(now), yest = dayKey(now - DAY);
  if (p.lastDay !== today) { p.streak = p.lastDay === yest ? p.streak + 1 : 1; p.lastDay = today; }
  return p;
}
