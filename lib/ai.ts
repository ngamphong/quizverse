/**
 * Every AI feature goes through this file.
 * Phase 1: AI is switched off (AI_READY = false), so AI buttons show a "coming in phase 2" note.
 * Phase 2: these functions call our own API routes (/api/ai/*), which call Gemini on the server
 * with GEMINI_API_KEY — the key never reaches the browser.
 */
import type { Question } from "./types";

export const AI_READY = false;
export const AI_OFF_NOTE = "ฟีเจอร์ AI (Gemini) จะเปิดใช้ในระยะที่ 2 ตอนนี้สร้างคำถามเองได้ในแท็บ \"สร้างเอง\"";

export interface GenerateRequest {
  subject: string;
  count: number;
  level: "mix" | "1" | "2" | "3";
  content: string;
}

export async function generateQuestions(_req: GenerateRequest): Promise<Question[]> {
  throw new Error("AI ยังไม่เปิดใช้");
}

export async function explainMistake(_q: Question, _choice: number): Promise<string> {
  throw new Error("AI ยังไม่เปิดใช้");
}

export async function studyCoach(_summary: string): Promise<string> {
  throw new Error("AI ยังไม่เปิดใช้");
}
