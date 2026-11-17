"use client";
import { useSoundOn } from "@/lib/sound";

/** Speaker button that turns game sounds on and off (remembered on this device). */
export default function SoundToggle({ withLabel }: { withLabel?: boolean }) {
  const [on, set] = useSoundOn();
  return (
    <button type="button" className={"sound-btn" + (withLabel ? " labeled" : "")} onClick={() => set(!on)}
      aria-pressed={on} aria-label={on ? "ปิดเสียง" : "เปิดเสียง"} title={on ? "ปิดเสียง" : "เปิดเสียง"}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 5 6 9H2v6h4l5 4z" />
        {on ? <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /> : <path d="m22 9-6 6M16 9l6 6" />}
      </svg>
      {withLabel && <span>{on ? "เสียง: เปิด" : "เสียง: ปิด"}</span>}
    </button>
  );
}
