import "server-only";

/**
 * Best-effort limit on AI calls per visitor, to protect the Gemini quota.
 * Kept in memory, so each Vercel instance counts separately — good enough
 * for a class project; phase 3 can move it to the database.
 */
const WINDOW_MS = 10 * 60_000;
const MAX_CALLS = 30;
const hits = new Map<string, number[]>();

export function rateLimited(req: Request): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_CALLS) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return false;
}
