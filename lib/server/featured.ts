import "server-only";
import { supabaseAdmin } from "../supabase/server";

export interface FeaturedQuiz {
  pin: string;
  title: string;
  count: number;
  topics: string[];
  plays: number;
  author: string | null; // null when the teacher chose not to show their name
  sample: boolean;
}

/**
 * Quizzes for the home page: the sample room plus quizzes whose teachers agreed
 * to share them (is_public). Questions are never exposed here — only title, PIN and stats.
 */
export async function featuredQuizzes(limit = 12): Promise<FeaturedQuiz[]> {
  const db = supabaseAdmin();
  type Row = { id: string; pin: string; title: string; owner_id: string | null; is_sample: boolean; show_author?: boolean; shared_at?: string | null; questions: { topic: string }[] | null };
  const shared = await db.from("quizzes").select("id, pin, title, owner_id, is_sample, is_public, show_author, shared_at, questions(topic)")
    .or("is_sample.eq.true,is_public.eq.true").limit(60).returns<Row[]>();
  let rows: Row[] = shared.data ?? [];
  if (shared.error) {
    // share.sql not run yet → just the sample room
    const sample = await db.from("quizzes").select("id, pin, title, owner_id, is_sample, questions(topic)").eq("is_sample", true).limit(5).returns<Row[]>();
    if (sample.error) return [];
    rows = sample.data ?? [];
  }
  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const owners = [...new Set(rows.filter((r) => r.owner_id && r.show_author !== false).map((r) => r.owner_id as string))];
  const [{ data: sessions }, { data: rooms }, { data: profiles }] = await Promise.all([
    db.from("game_sessions").select("quiz_id").in("quiz_id", ids).not("finished_at", "is", null).limit(5000),
    db.from("live_rooms").select("id, quiz_id").in("quiz_id", ids).limit(2000),
    owners.length ? db.from("profiles").select("id, display_name").in("id", owners) : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
  ]);
  const plays = new Map<string, number>();
  (sessions ?? []).forEach((s) => plays.set(s.quiz_id, (plays.get(s.quiz_id) ?? 0) + 1));
  (rooms ?? []).forEach((r) => plays.set(r.quiz_id, (plays.get(r.quiz_id) ?? 0) + 1));
  const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  return rows
    .map((r) => {
      const topics = (r.questions ?? []).map((q) => q.topic);
      return {
        pin: r.pin, title: r.title, count: topics.length, topics: [...new Set(topics)],
        plays: plays.get(r.id) ?? 0, sample: !!r.is_sample,
        author: r.is_sample ? "QUIZVERSE" : r.show_author !== false && r.owner_id ? names.get(r.owner_id) ?? null : null,
        sharedAt: r.shared_at ?? "",
      };
    })
    .filter((q) => q.count >= 3)
    .sort((a, b) => b.plays - a.plays || b.sharedAt.localeCompare(a.sharedAt))
    .slice(0, limit)
    .map(({ sharedAt: _s, ...q }) => q);
}
