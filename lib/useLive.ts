"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveState } from "./liveTypes";
import { supabaseBrowser } from "./supabase/client";

/**
 * Keeps a live room's state in sync with the server.
 * Realtime messages only say "something changed"; the state itself always comes from
 * /api/live/state, and a slow poll covers missed messages.
 */
export function useLiveState(url: string | null, pin: string | null, opts: { host?: boolean; answers?: boolean } = {}) {
  const [state, setState] = useState<LiveState | null>(null);
  const [error, setError] = useState("");
  const offset = useRef(0); // serverNow - Date.now()
  const inFlight = useRef(false);
  const again = useRef(false);

  const refresh = useCallback(async () => {
    if (!url) return;
    if (inFlight.current) { again.current = true; return; }
    inFlight.current = true;
    try {
      const r = await fetch(url, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "โหลดสถานะห้องไม่สำเร็จ"); return; }
      offset.current = d.serverNow - Date.now();
      setError("");
      setState(d as LiveState);
    } catch {
      setError("การเชื่อมต่อขาดหาย กำลังลองใหม่…");
    } finally {
      inFlight.current = false;
      if (again.current) { again.current = false; refresh(); }
    }
  }, [url]);

  useEffect(() => {
    if (!url) return;
    refresh();
    // polling also lets the server auto-reveal when time is up, even if the host's screen is asleep
    const poll = setInterval(refresh, opts.host ? 2000 : 2500);
    return () => clearInterval(poll);
  }, [url, refresh, opts.host]);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb || !pin) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const soon = () => { if (!t) t = setTimeout(() => { t = null; refresh(); }, 150); };
    const ch = sb.channel(`live-${pin}`)
      .on("broadcast", { event: "state" }, soon)
      .on("broadcast", { event: "players" }, soon);
    // the host shows the answer count live; in team mode players also see teammates' votes live
    if (opts.host || opts.answers) ch.on("broadcast", { event: "answered" }, soon);
    ch.subscribe();
    return () => { if (t) clearTimeout(t); sb.removeChannel(ch); };
  }, [pin, refresh, opts.host, opts.answers]);

  /** Seconds since the current question opened, using server time (not capped). */
  const elapsed = useCallback(() => {
    if (!state?.startedAt) return 0;
    return (Date.now() + offset.current - state.startedAt) / 1000;
  }, [state]);

  /** Seconds left on the current question (0 when time is up). */
  const secondsLeft = useCallback(() => {
    if (!state?.startedAt) return state?.timeLimit ?? 20;
    return Math.max(0, Math.ceil(state.timeLimit - elapsed()));
  }, [state, elapsed]);

  return { state, error, refresh, secondsLeft, elapsed };
}

/** Re-renders every 250 ms while `active`, for countdowns. */
export function useTicker(active: boolean) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => set((x) => x + 1), 250);
    return () => clearInterval(id);
  }, [active]);
}
