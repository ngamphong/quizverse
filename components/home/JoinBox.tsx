"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Hero PIN box: type the room PIN and jump straight into a live room or a solo quiz. */
export default function JoinBox() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length !== 6) return setErr("PIN ต้องเป็นตัวเลข 6 หลัก");
    setBusy(true); setErr("");
    const live = await fetch(`/api/live?pin=${pin}`).then((r) => r.json()).then((d) => !!d.live).catch(() => false);
    router.push(live ? `/live/${pin}` : `/play/${pin}`);
  }

  return (
    <form className="pin-box" onSubmit={go} noValidate>
      <label htmlFor="heroPin" className="sr-only">Game PIN</label>
      <input id="heroPin" inputMode="numeric" autoComplete="off" maxLength={6} placeholder="กรอก PIN 6 หลัก" value={pin}
        onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setErr(""); }} />
      <button className="btn btn-white" type="submit" disabled={busy}>{busy ? "กำลังเข้า…" : "เข้าเล่น →"}</button>
      {err && <span className="pin-err">{err}</span>}
    </form>
  );
}
