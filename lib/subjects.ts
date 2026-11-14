import { SUBJECTS } from "./constants";

/** Teachers may use their own subject names (e.g. ฟิสิกส์, ประวัติศาสตร์). Returns null if unusable. */
export function normalizeSubject(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
  return t.length >= 1 ? t : null;
}

/** Core subjects first, then any extra subjects that have data. */
export function withExtraSubjects(extra: Iterable<string>): string[] {
  const out = [...SUBJECTS];
  for (const s of extra) if (s && !out.includes(s)) out.push(s);
  return out;
}

export const MAX_AI_QUESTIONS = 15;
