import "server-only";
import type { Question } from "../types";

/** JSON Schema for one multiple-choice question (used to constrain Gemini's output). */
export const QUESTION_SCHEMA = {
  type: "object",
  properties: {
    q: { type: "string", description: "คำถาม" },
    choices: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4, description: "ตัวเลือก 4 ข้อ" },
    answer: { type: "integer", minimum: 0, maximum: 3, description: "index ของตัวเลือกที่ถูก (0-3)" },
    explain: { type: "string", description: "คำอธิบายเฉลยไม่เกิน 2 ประโยค" },
    level: { type: "integer", minimum: 1, maximum: 3, description: "1 ง่าย, 2 ปานกลาง, 3 ยาก" },
  },
  required: ["q", "choices", "answer", "explain", "level"],
} as const;

/** Keeps only well-formed questions; never trust model output blindly. */
export function cleanQuestion(x: unknown, topic: string): Question | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const choices = Array.isArray(o.choices) ? o.choices.map((c) => String(c ?? "").trim()) : [];
  const answer = Number(o.answer);
  const q = String(o.q ?? "").trim();
  if (!q || choices.length !== 4 || choices.some((c) => !c) || !Number.isInteger(answer) || answer < 0 || answer > 3) return null;
  if (new Set(choices).size !== 4) return null; // duplicate options make the question ambiguous
  const level = [1, 2, 3].includes(Number(o.level)) ? Number(o.level) : 2;
  return { topic, level, q: q.slice(0, 500), choices: choices.map((c) => c.slice(0, 200)), answer, explain: String(o.explain ?? "").trim().slice(0, 600) };
}
