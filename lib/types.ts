export interface Question {
  topic: string;
  level: number; // 1 ง่าย, 2 ปานกลาง, 3 ยาก
  q: string;
  choices: string[];
  answer: number; // index 0-3
  explain: string;
  qid?: string;
  /** database id (questions served by the game API) */
  id?: string;
}

/** What a player sees before answering — no answer key, no explanation. */
export interface ClientQuestion {
  id: string;
  topic: string;
  level: number;
  q: string;
  choices: string[];
}

export interface GameResult {
  name: string;
  score: number;
  total: number;
  maxLevel: number;
  answers: AnswerRecord[];
  players: Player[];
}

export interface Quiz {
  pin: string;
  title: string;
  questions: Question[];
  example?: boolean;
}

export interface Draft extends Question {
  approved: boolean;
  src: "manual" | "ai";
}

export type Conf = "sure" | "mid" | "guess" | "none";

export interface AnswerRecord {
  q: Question;
  choice: number; // -1 = timed out
  correct: boolean;
  points: number;
  conf: Conf;
}

export interface RevisionItem extends Question {
  qid: string;
  step: number;
  due: number;
  reason: string;
}

export interface TopicStat {
  right: number;
  total: number;
  hist: number[];
}

export interface Profile {
  example: boolean;
  name: string;
  xp: number;
  games: number;
  streak: number;
  lastDay: string | null;
  stats: Record<string, TopicStat>;
  conf: { sureWrong: number; guessRight: number };
  revision: RevisionItem[];
  mastered: number;
  bestJump: number;
}

export interface Player {
  name: string;
  score: number;
  me?: boolean;
  bot?: boolean;
}
