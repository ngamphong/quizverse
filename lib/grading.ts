import { TIME_LIMIT } from "./constants";
import type { Question } from "./types";

/**
 * Scores one answer: correctness + speed + a bonus for harder questions.
 * Phase 3 moves this call to the server so students cannot fake scores.
 */
export function gradeAnswer(question: Question, choice: number, timeLeft: number) {
  const correct = choice === question.answer;
  const points = correct ? Math.round(500 + 500 * (timeLeft / TIME_LIMIT)) + (question.level - 1) * 100 : 0;
  return { correct, points };
}
