"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Leaderboard } from "@/components/LiveBoard";
import MistakeHelper from "@/components/MistakeHelper";
import { TeamBoard, TeamRevealList, TeamVotes } from "@/components/TeamViews";
import { CONF_TXT, KEYS, TIME_LIMIT } from "@/lib/constants";
import { TEAM_NAMES } from "@/lib/liveTypes";
import { applyToProfile } from "@/lib/profile";
import { loadProfile, saveProfile } from "@/lib/storage";
import type { Conf } from "@/lib/types";
import { useLiveState, useTicker } from "@/lib/useLive";
import { useMe } from "@/lib/useMe";

interface Creds { pid: string; token: string }
const credKey = (pin: string) => `qv_live_${pin}`;
const readCreds = (pin: string): Creds | null => { try { return JSON.parse(sessionStorage.getItem(credKey(pin)) || "null"); } catch { return null; } };

/** Student's screen in a live room (phone-sized). Team mode = Collaborative Challenge. */
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
  const [sending, setSending] = useState(false);
  const [pick, setPick] = useState<number | null>(null); // team mode: chosen but not yet sent
  const [reason, setReason] = useState("");
  const [teamMode, setTeamMode] = useState(false);

  useEffect(() => { setCreds(readCreds(pin)); setName(loadProfile().name); setReady(true); }, [pin]);

  const url = useMemo(() => (creds ? `/api/live/state?pid=${creds.pid}&token=${encodeURIComponent(creds.token)}` : null), [creds]);
  const { state: s, error, refresh, secondsLeft } = useLiveState(url, creds ? pin : null, { answers: teamMode });
  useTicker(s?.state === "question");
  useEffect(() => { if (s?.teamMode) setTeamMode(true); }, [s?.teamMode]);

  // a fresh question resets local answer state
  const qIndex = s?.state === "question" ? s.index : null;
  useEffect(() => {
    if (qIndex === null || sentFor === qIndex) return;
    setConf("sure"); setSendErr(""); setPick(null); setReason("");
  }, [qIndex, sentFor]);

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

  async function send(choice: number, why?: string) {
    if (!creds || !s || s.state !== "question" || sending) return;
    if (!s.teamMode && sentFor === s.index) return;
    if (s.teamMode && (why ?? "").trim().length < 3) return setSendErr("เขียนเหตุผลสั้นๆ อย่างน้อย 3 ตัวอักษร ให้เพื่อนในทีมอ่าน");
    setSending(true); setSendErr("");
    try {
      const r = await fetch("/api/live/answer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pid: creds.pid, token: creds.token, choice, conf, reason: why }) });
      if (r.ok) setSentFor(s.index);
      else {
        const d = await r.json().catch(() => ({}));
        if (r.status === 409 && !/หมดเวลา/.test(d.error ?? "")) setSentFor(s.index);
        else setSendErr(d.error || "ส่งคำตอบไม่สำเร็จ");
      }
    } catch {
      setSendErr("เชื่อมต่อไม่ได้ ลองกดส่งอีกครั้ง");
    } finally {
      setSending(false);
      refresh();
    }
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
  const myTeam = s.me?.team ?? null;
  const teamLabel = myTeam != null ? TEAM_NAMES[myTeam] ?? `ทีม ${myTeam + 1}` : null;

  return (
    <section className="view" style={{ maxWidth: 720, width: "100%", alignSelf: "center" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="pill">ห้องสด {s.pin}{s.teamMode ? " · โหมดทีม" : ""}</span>
        <span className="pill num">{s.me?.name}{teamLabel ? ` · ${teamLabel}` : ""} · {(s.me?.score ?? 0).toLocaleString()} คะแนน{s.me?.rank ? ` · อันดับ ${s.me.rank}` : ""}</span>
      </div>
      {error && <p className="err">{error}</p>}

      {s.state === "lobby" && (
        <div className="qcard" style={{ textAlign: "center", alignItems: "center", gap: 12 }}>
          <h2>เข้าห้องแล้ว!</h2>
          <p style={{ opacity: 0.9 }}>รอครูเริ่มเกม · ตอนนี้มี {s.playerCount} คนในห้อง</p>
          {s.teamMode && <p style={{ opacity: 0.9 }}>เกมนี้เล่นเป็นทีม: ระบบจะจัดทีมเมื่อครูกดเริ่ม ทุกคนต้องเลือกคำตอบพร้อมเหตุผล แล้วทีมตัดสินด้วยเสียงข้างมาก</p>}
        </div>
      )}

      {s.state === "question" && s.question && !s.teamMode && (
        answered ? (
          <div className="qcard" style={{ textAlign: "center", alignItems: "center", gap: 10 }}>
            <h2>ส่งคำตอบแล้ว</h2>
            <p style={{ opacity: 0.9 }}>รอครูเฉลย… (เหลือ {left} วินาที)</p>
          </div>
        ) : (
          <>
            <QuestionHead s={s} left={left} />
            <div className="conf">
              <span className="muted">ความมั่นใจ:</span>
              {(["sure", "mid", "guess"] as const).map((c) => <button key={c} className={conf === c ? "on" : ""} onClick={() => setConf(c)}>{CONF_TXT[c]}</button>)}
            </div>
            <div className="choices">
              {s.question.choices.map((c, i) => (
                <button key={i} className={`choice ch${i}`} disabled={left <= 0 || sending} onClick={() => send(i)}>
                  <span className="key">{KEYS[i]}</span><span>{c}</span>
                </button>
              ))}
            </div>
            {sendErr && <p className="err">{sendErr}</p>}
          </>
        )
      )}

      {s.state === "question" && s.question && s.teamMode && (
        <>
          <QuestionHead s={s} left={left} />
          {teamLabel && <p className="small"><span className="pill">{teamLabel}</span> เลือกคำตอบพร้อมเหตุผล ดูเหตุผลของเพื่อน แล้วเปลี่ยนใจได้จนหมดเวลา</p>}
          <div className="choices">
            {s.question.choices.map((c, i) => {
              const chosen = (pick ?? s.me?.myChoice) === i;
              return (
                <button key={i} className={`choice ch${i}`} disabled={left <= 0} onClick={() => setPick(i)}
                  style={chosen ? { outline: "4px solid var(--ink)", outlineOffset: 3 } : (pick ?? s.me?.myChoice) != null ? { opacity: 0.55 } : undefined}>
                  <span className="key">{KEYS[i]}</span><span>{c}</span>
                </button>
              );
            })}
          </div>
          <label className="fld">เหตุผลของฉัน (เพื่อนในทีมจะเห็น)
            <textarea id="teamReason" rows={2} maxLength={300} style={{ minHeight: 60 }} value={reason || (pick === null ? s.me?.myReason ?? "" : reason)}
              placeholder="เช่น เพราะแกนโลกเอียงทำให้แสงตกกระทบต่างกัน" onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="small muted">{answered ? `ส่งแล้ว: ${s.me?.myChoice != null && s.me.myChoice >= 0 ? KEYS[s.me.myChoice] : "-"} · เปลี่ยนได้จนหมดเวลา` : "ยังไม่ได้ส่ง"}</span>
            <button className="btn btn-primary" disabled={left <= 0 || sending || (pick ?? s.me?.myChoice ?? null) === null}
              onClick={() => send((pick ?? s.me?.myChoice)!, reason || s.me?.myReason || "")}>
              {sending ? "กำลังส่ง…" : answered ? "อัปเดตคำตอบของฉัน" : "ส่งคำตอบ + เหตุผล"}
            </button>
          </div>
          {sendErr && <p className="err">{sendErr}</p>}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8, boxShadow: "none" }}>
            <h3 style={{ fontSize: 15 }}>เพื่อนในทีมเลือกอะไร เพราะอะไร</h3>
            <TeamVotes votes={s.me?.teamVotes ?? []} choices={s.question.choices} />
          </div>
        </>
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
            {s.teamMode && s.teamReveal && (
              <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <h3 style={{ fontSize: 16 }}>ผลของแต่ละทีม และเหตุผล</h3>
                <TeamRevealList teams={s.teamReveal} choices={q.choices} myTeam={myTeam} />
                {s.teams && <><h3 style={{ fontSize: 15 }}>อันดับทีม</h3><TeamBoard teams={s.teams} /></>}
              </div>
            )}
            <p className="small muted" style={{ textAlign: "center" }}>รอครูเปิดข้อต่อไป…</p>
          </>
        );
      })()}

      {s.state === "ended" && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {s.teamMode && s.teams?.length ? (
            <>
              <h3 style={{ fontSize: 22 }}>จบเกม! {s.teams[0].name} ชนะ{s.teams[0].mine ? " (ทีมของคุณ!)" : ""}</h3>
              <TeamBoard teams={s.teams} />
              <h3 style={{ fontSize: 15 }}>คะแนนรายคน</h3>
            </>
          ) : (
            <h3 style={{ fontSize: 22 }}>จบเกม! คุณได้อันดับ {s.me?.rank} จาก {s.playerCount} คน</h3>
          )}
          <p className="big-score num">{(s.me?.score ?? 0).toLocaleString()} คะแนน</p>
          <Leaderboard rows={s.leaderboard ?? []} />
          <p className="small muted">{me ? "ผลถูกบันทึกเข้า Learning DNA ในบัญชีของคุณแล้ว" : "ผลถูกบันทึกเข้า Learning DNA ในเครื่องนี้แล้ว"}</p>
          <Link className="btn btn-primary" href="/dna">ดูการวิเคราะห์การเรียนรู้</Link>
        </div>
      )}
      {!s.teamMode && <p className="small muted" style={{ textAlign: "center" }}>ความมั่นใจที่เลือก: {CONF_TXT[conf]} · คะแนนตรวจและจับเวลาโดยเซิร์ฟเวอร์</p>}
    </section>
  );
}

function QuestionHead({ s, left }: { s: NonNullable<ReturnType<typeof useLiveState>["state"]>; left: number }) {
  return (
    <>
      <div className="arena-top">
        <span className="pill num">ข้อ {s.index + 1}/{s.total}</span>
        <div className="progress"><i style={{ width: `${(s.index / s.total) * 100}%` }} /></div>
        <div className="timer" style={{ ["--p" as string]: `${(left / TIME_LIMIT) * 100}%` }}><span className="num">{left}</span></div>
      </div>
      <div className="qcard">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {s.question?.image && <img className="qimg" src={s.question.image} alt="รูปประกอบคำถาม" />}
        <h2>{s.question?.q}</h2>
      </div>
    </>
  );
}
