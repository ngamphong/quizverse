import type { Question } from "./types";

/** AI Adaptive Quiz: 2 correct in a row → harder; any wrong → easier. */
export function adjustLevel(level: number, streak: number, correct: boolean) {
  if (correct) {
    streak++;
    if (streak >= 2 && level < 3) { level++; streak = 0; }
  } else {
    streak = 0;
    if (level > 1) level--;
  }
  return { level, streak };
}

/** Next question: closest to the target level, avoiding the same subject twice in a row. */
export function pickQuestion(pool: Question[], asked: Question[], level: number, practice: boolean): Question {
  const left = pool.filter((q) => !asked.includes(q));
  if (practice) return left[0];
  const last = asked[asked.length - 1];
  const dist = (q: Question) => Math.abs(q.level - level);
  const same = (q: Question) => (q.topic === last?.topic ? 1 : 0);
  left.sort((a, b) => dist(a) - dist(b) || same(a) - same(b) || Math.random() - 0.5);
  const best = left.filter((q) => dist(q) === dist(left[0]) && same(q) === same(left[0]));
  return best[Math.floor(Math.random() * best.length)];
}
