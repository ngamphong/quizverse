import "server-only";
import { SUPABASE_URL } from "../supabase/config";
import type { Question } from "../types";

export const IMAGE_BUCKET = "question-images";

/** Accept only pictures stored in our own bucket (never arbitrary URLs). */
export function cleanImageUrl(u: unknown): string | null {
  if (typeof u !== "string" || !u) return null;
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/`;
  return SUPABASE_URL && u.startsWith(prefix) && u.length < 500 && !u.includes("..") ? u : null;
}

/** DB column list for questions, exposing image_url as `image`. */
export const QUESTION_COLUMNS = "id, topic, level, q, choices, answer, explain, image:image_url";
const LEGACY_COLUMNS = "id, topic, level, q, choices, answer, explain";

/**
 * Runs a questions query with the image column, and retries without it if
 * supabase/teacher.sql has not been run yet (Postgres 42703 = unknown column),
 * so games keep working during an upgrade.
 */
export async function selectQuestions<T>(
  run: (columns: string) => PromiseLike<{ data: T[] | null; error: { code?: string } | null }>,
): Promise<{ data: T[] | null; error: { code?: string } | null }> {
  const res = await run(QUESTION_COLUMNS);
  if (res.error?.code === "42703") return run(LEGACY_COLUMNS);
  return res;
}

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
