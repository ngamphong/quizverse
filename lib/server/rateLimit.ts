import "server-only";

/**
 * Best-effort limit per visitor and per bucket (e.g. "ai", "game").
 * Kept in memory, so each Vercel instance counts separately — good enough
 * to stop accidental floods and protect the Gemini quota.
 */
const WINDOW_MS = 10 * 60_000;
const hits = new Map<string, number[]>();

export function rateLimited(req: Request, bucket = "ai", max = 30): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const key = bucket + ":" + ip;
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= max) { hits.set(key, list); return true; }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return false;
}
