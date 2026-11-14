import { SUBJECTS } from "./constants";
import { pct } from "./profile";
import type { Profile } from "./types";

/** Learning Quest: 5 stages per subject, easy → hard. */
export const STAGES = [1, 2, 3, 4, 5] as const;
export const QUEST_SIZE = 5; // questions per stage
export const PASS = 3; // correct answers needed to pass
export const STAGE_NAME: Record<number, string> = { 1: "ปูพื้นฐาน", 2: "ฝึกฝน", 3: "ประยุกต์", 4: "ท้าทาย", 5: "บอสใหญ่" };
export const STAGE_LEVEL: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3 };

export const starsFor = (correct: number) => (correct >= 5 ? 3 : correct >= 4 ? 2 : correct >= PASS ? 1 : 0);

export function stageStars(p: Profile, subject: string, stage: number) {
  return p.quest?.[subject]?.[String(stage)] ?? 0;
}
/** A stage is open when it is the first one or the previous one was passed. */
export function stageOpen(p: Profile, subject: string, stage: number) {
  return stage === 1 || stageStars(p, subject, stage - 1) > 0;
}
export function subjectProgress(p: Profile, subject: string) {
  const passed = STAGES.filter((s) => stageStars(p, subject, s) > 0).length;
  const stars = STAGES.reduce((t, s) => t + stageStars(p, subject, s), 0);
  return { passed, stars };
}

/** "Use learning results to set the next mission": weakest subject with an unfinished stage. */
export function recommend(p: Profile): { subject: string; stage: number; why: string } | null {
  const ranked = SUBJECTS.map((s) => ({ s, v: p.stats[s]?.total ? pct(p.stats[s]) : 50 })).sort((a, b) => a.v - b.v);
  for (const { s, v } of ranked) {
    const next = STAGES.find((st) => stageStars(p, s, st) === 0 && stageOpen(p, s, st));
    if (next) {
      const why = p.stats[s]?.total ? `${s} เป็นวิชาที่คุณได้คะแนนต่ำสุดตอนนี้ (${v}%)` : `ยังไม่มีผลวิชา${s} มาเริ่มเก็บกัน`;
      return { subject: s, stage: next, why };
    }
  }
  return null;
}

/** Applies a finished stage: best stars are kept; XP for new stars. Returns the gained XP. */
export function applyQuest(p: Profile, subject: string, stage: number, correct: number): number {
  const stars = starsFor(correct);
  const before = stageStars(p, subject, stage);
  p.quest ||= {};
  p.quest[subject] ||= {};
  if (stars > before) p.quest[subject][String(stage)] = stars;
  const gained = Math.max(0, stars - before) * 15 + (stars > 0 ? 5 : 0);
  p.xp += gained;
  return gained;
}
