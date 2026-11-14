"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Leaderboard } from "@/components/LiveBoard";
import MistakeHelper from "@/components/MistakeHelper";
import { CONF_TXT, KEYS, TIME_LIMIT } from "@/lib/constants";
import { applyToProfile } from "@/lib/profile";
import { loadProfile, saveProfile } from "@/lib/storage";
import type { Conf } from "@/lib/types";
import { useLiveState, useTicker } from "@/lib/useLive";
import { useMe } from "@/lib/useMe";

interface Creds { pid: string; token: string }
const credKey = (pin: string) => `qv_live_${pin}`;
const readCreds = (pin: string): Creds | null => { try { return JSON.parse(sessionStorage.getItem(credKey(pin)) || "null"); } catch { return null; } };

/** Student's screen in a live room (phone-sized). */
export default function LivePlayerPage() {
  const { pin } = useParams<{ pin: string }>();
  const { me } = useMe();
  const [creds, setCreds] = useState<Creds | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [joining, setJoining] = useState(false);
  const [conf, setConf] = useState<Conf>("sure");
  const [sentFor, setSentFor] = useState<number | null>(null); // question index we already answered
  const [sendErr, setSendErr] = useState("");

  useEffect(() => { setCreds(readCreds(pin)); setName(loadProfile().name); setReady(true); }, [pin]);

  const url = useMemo(() => (creds ? `/api/live/state?pid=${creds.pid}&token=${encodeURIComponent(creds.token)}` : null), [creds]);
  const { state: s, error, refresh, secondsLeft } = useLiveState(url, creds ? pin : null);
  useTicker(s?.state === "question");

  // a fresh question resets the local "sent" flag and confidence
  useEffect(() => { if (s?.state === "question" && sentFor !== s.index) { setConf("sure"); setSendErr(""); } }, [s?.state, s?.index, sentFor]);

  // guests keep Learning DNA in this browser; apply the game once when it ends
  useEffect(() => {
    if (s?.state !== "ended" || me || !s.me?.answers?.length) return;
    const flag = `qv_live_done_${pin}_${creds?.pid}`;
    try { if (sessionStorage.getItem(flag)) return; sessionStorage.setItem(flag, "1"); } catch { /* ignore */ }
    saveProfile(applyToProfile(loadProfile(), s.me.answers.map((a) => ({ ...a, conf: a.conf as Conf })), false));
  }, [s, me, pin, creds?.pid]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    const nm = (me?.name ?? name).trim();
    if (!nm) return setErr("กรุณาตั้งชื่อผู้เล่น");
    setJoining(true); setErr("");
    try {
      const r = await fetch("/api/live/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin, nickname: nm }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setErr(d.error || "เข้าห้องไม่สำเร็จ");
      const c = { pid: d.playerId, token: d.token };
      try { sessionStorage.setItem(credKey(pin), JSON.stringify(c)); } catch { /* ignore */ }
      if (!me) { const p = loadProfile(); if (p.name !== nm) saveProfile({ ...p, name: nm }); }
      setCreds(c);
    } finally {
      setJoining(false);
    }
  }

  async function answer(choice: number) {
    if (!creds || !s || s.state !== "question" || sentFor === s.index) return;
    setSentFor(s.index);
    const r = await fetch("/api/live/answer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pid: creds.pid, token: creds.token, choice, conf }) });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      if (r.status !== 409 || /หมดเวลา/.test(d.error ?? "")) setSendErr(d.error || "ส่งคำตอบไม่สำเร็จ");
      if (r.status !== 409) setSentFor(null); // let them try again on network errors
    }
    refresh();
  }

  if (!ready) return <p className="loading">กำลังโหลด…</p>;

  if (!creds)
    return (
      <section className="view" style={{ alignItems: "center" }}>
        <form className="card join-card" style={{ width: "100%", maxWidth: 420 }} onSubmit={join} noValidate>
          <p className="eyebrow">ห้องสด · PIN {pin}</p>
          <h2 style={{ fontSize: 24 }}>เข้าห้องเรียนสด</h2>
          {me ? <p>เล่นในชื่อ <b>{me.name}</b></p> : (
            <label className="fld">ชื่อผู้เล่น<input type="text" id="liveName" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} /></label>
          )}
          <p className="err">{err}</p>
          <button className="btn btn-primary" type="submit" disabled={joining}>{joining ? "กำลังเข้าห้อง…" : "เข้าห้อง →"}</button>
        </form>
      </section>
    );

  if (!s)
    return (
      <section className="view">
        <p className="loading">{error || "กำลังเชื่อมต่อห้อง…"}</p>
        {error && <button className="btn btn-ghost" onClick={() => { try { sessionStorage.removeItem(credKey(pin)); } catch { /* ignore */ } setCreds(null); }}>เข้าห้องใหม่</button>}
      </section>
    );

  const left = s.state === "question" ? secondsLeft() : TIME_LIMIT;
  const answered = s.me?.answered || sentFor === s.index;

  return (
    <section className="view" style={{ maxWidth: 720, width: "100%", alignSelf: "center" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="pill">ห้องสด {s.pin}</span>
        <span className="pill num">{s.me?.name} · {(s.me?.score ?? 0).toLocaleString()} คะแนน{s.me?.rank ? ` · อันดับ ${s.me.rank}` : ""}</span>
      </div>
      {error && <p className="err">{error}</p>}

      {s.state === "lobby" && (
        <div className="qcard" style={{ textAlign: "center", alignItems: "center", gap: 12 }}>
          <h2>เข้าห้องแล้ว!</h2>
          <p style={{ opacity: 0.9 }}>รอครูเริ่มเกม · ตอนนี้มี {s.playerCount} คนในห้อง</p>
        </div>
      )}

      {s.state === "question" && s.question && (
        answered ? (
          <div className="qcard" style={{ textAlign: "center", alignItems: "center", gap: 10 }}>
            <h2>ส่งคำตอบแล้ว</h2>
            <p style={{ opacity: 0.9 }}>รอครูเฉลย… (เหลือ {left} วินาที)</p>
          </div>
        ) : (
          <>
            <div className="arena-top">
              <span className="pill num">ข้อ {s.index + 1}/{s.total}</span>
              <div className="progress"><i style={{ width: `${(s.index / s.total) * 100}%` }} /></div>
              <div className="timer" style={{ ["--p" as string]: `${(left / TIME_LIMIT) * 100}%` }}><span className="num">{left}</span></div>
            </div>
            <div className="qcard"><h2>{s.question.q}</h2></div>
            <div className="conf">
              <span className="muted">ความมั่นใจ:</span>
              {(["sure", "mid", "guess"] as const).map((c) => (
                <button key={c} className={conf === c ? "on" : ""} onClick={() => setConf(c)}>{CONF_TXT[c]}</button>
              ))}
            </div>
            <div className="choices">
              {s.question.choices.map((c, i) => (
                <button key={i} className={`choice ch${i}`} disabled={left <= 0} onClick={() => answer(i)}>
                  <span className="key">{KEYS[i]}</span><span>{c}</span>
                </button>
              ))}
            </div>
            {sendErr && <p className="err">{sendErr}</p>}
          </>
        )
      )}

      {s.state === "reveal" && s.reveal && (() => {
        const q = s.reveal.question, last = s.me?.last;
        return (
          <>
            <div className={"feedback " + (last?.correct ? "good" : "bad")}>
              <h3 style={{ color: last?.correct ? "var(--ok)" : "var(--bad)" }}>
                {last ? (last.correct ? `ถูกต้อง! +${last.points} คะแนน` : "ยังไม่ถูก") : "ไม่ได้ตอบข้อนี้"}
              </h3>
              <p><b>{q.q}</b></p>
              <p>คำตอบที่ถูกคือ {KEYS[q.answer]}. {q.choices[q.answer]} — {q.explain}</p>
              {last && !last.correct && <MistakeHelper key={q.id} question={q} choice={last.choice} />}
            </div>
            <p className="small muted" style={{ textAlign: "center" }}>รอครูเปิดข้อต่อไป…</p>
          </>
        );
      })()}

      {s.state === "ended" && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h3 style={{ fontSize: 22 }}>จบเกม! คุณได้อันดับ {s.me?.rank} จาก {s.playerCount} คน</h3>
          <p className="big-score num">{(s.me?.score ?? 0).toLocaleString()} คะแนน</p>
          <Leaderboard rows={s.leaderboard ?? []} />
          <p className="small muted">{me ? "ผลถูกบันทึกเข้า Learning DNA ในบัญชีของคุณแล้ว" : "ผลถูกบันทึกเข้า Learning DNA ในเครื่องนี้แล้ว"}</p>
          <Link className="btn btn-primary" href="/dna">ดูการวิเคราะห์การเรียนรู้</Link>
        </div>
      )}
      <p className="small muted" style={{ textAlign: "center" }}>ความมั่นใจที่เลือก: {CONF_TXT[conf]} · คะแนนตรวจและจับเวลาโดยเซิร์ฟเวอร์</p>
    </section>
  );
}
