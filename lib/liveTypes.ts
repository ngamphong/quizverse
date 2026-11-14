import type { ClientQuestion, Question } from "./types";

export type LiveStateName = "lobby" | "question" | "reveal" | "ended";

export interface LiveRow { name: string; score: number; me?: boolean }

/** What /api/live/state returns. Fields appear only when they make sense for the state and viewer. */
export interface LiveState {
  roomId?: string; // host only
  pin: string;
  title: string;
  state: LiveStateName;
  index: number; // 0-based, -1 in lobby
  total: number;
  timeLimit: number;
  serverNow: number; // ms, to sync the countdown
  startedAt: number | null; // ms
  playerCount: number;
  players?: string[]; // lobby names
  question?: ClientQuestion; // no answer key while answering
  answeredCount?: number;
  reveal?: {
    question: Question; // with answer key, after the reveal
    distribution: number[]; // how many chose A-D
    leaderboard: LiveRow[];
  };
  leaderboard?: LiveRow[]; // final, when ended
  me?: {
    name: string;
    score: number;
    rank: number;
    answered?: boolean; // this question
    last?: { choice: number; correct: boolean; points: number } | null; // this question, shown at reveal
    answers?: { q: Question; choice: number; correct: boolean; points: number; conf: string }[]; // at the end (for Learning DNA)
  };
}
