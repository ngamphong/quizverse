"use client";
import { useEffect, useState } from "react";

/**
 * Short game sounds synthesised with Web Audio (no files to download).
 * On by default; the choice is kept per device.
 */
const KEY = "qv_sound";
const EVT = "qv-sound";
let ctx: AudioContext | null = null;

export function soundOn(): boolean {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}

export function setSoundOn(on: boolean) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* private mode */ }
  window.dispatchEvent(new Event(EVT));
  if (on) play("tap");
}

/** React state that follows the on/off switch everywhere on the page. */
export function useSoundOn(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const sync = () => setOn(soundOn());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return [on, setSoundOn];
}

type Note = [freq: number, start: number, dur: number, type?: OscillatorType, vol?: number];
const SOUNDS: Record<string, Note[]> = {
  tap: [[660, 0, 0.06, "triangle", 0.18]],
  correct: [[660, 0, 0.12, "triangle"], [880, 0.1, 0.12, "triangle"], [1320, 0.2, 0.22, "triangle"]],
  wrong: [[300, 0, 0.18, "sawtooth", 0.12], [220, 0.16, 0.3, "sawtooth", 0.12]],
  timeout: [[440, 0, 0.15, "square", 0.08], [330, 0.18, 0.3, "square", 0.08]],
  tick: [[1000, 0, 0.04, "square", 0.05]],
  finish: [[523, 0, 0.14, "triangle"], [659, 0.13, 0.14, "triangle"], [784, 0.26, 0.14, "triangle"], [1047, 0.39, 0.4, "triangle"]],
};
export type SoundName = keyof typeof SOUNDS;

export function play(name: SoundName) {
  if (typeof window === "undefined" || !soundOn()) return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime + 0.01;
    for (const [freq, start, dur, type = "sine", vol = 0.2] of SOUNDS[name]) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + start);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + dur + 0.02);
    }
  } catch { /* audio not available */ }
}
