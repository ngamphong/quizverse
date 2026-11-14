import "server-only";
import { supabaseAdmin } from "../supabase/server";

/**
 * Nudges every device in a live room to re-fetch its state from the server.
 * The message carries no game data, so a student who sends fake messages on the
 * public channel can only make others refresh — never change scores or answers.
 * Devices also poll every few seconds, so a lost message only adds a short delay.
 */
export async function nudge(pin: string, event: "state" | "answered" | "players") {
  try {
    const db = supabaseAdmin();
    const ch = db.channel(`live-${pin}`);
    await ch.httpSend(event, { t: Date.now() }, { timeout: 3000 });
    await db.removeChannel(ch);
  } catch (e) {
    console.warn("[realtime] nudge failed", e);
  }
}
