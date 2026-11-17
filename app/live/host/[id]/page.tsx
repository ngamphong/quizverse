"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Distribution, Leaderboard } from "@/components/LiveBoard";
import Podium from "@/components/Podium";
import QrCode from "@/components/QrCode";
import { TeamBoard, TeamRevealList } from "@/components/TeamViews";
import { KEYS, LEVEL, TIME_LIMIT } from "@/lib/constants";
import { toast } from "@/lib/storage";
import { useLiveState, useTicker } from "@/lib/useLive";

/** Teacher's screen for a live room — meant for the classroom projector. */
export default function HostPage() {
  const { id } = useParams<{ id: string }>();
  const [pin, setPin] = useState<string | null>(null);
  const { state: s, error, refresh, secondsLeft, elapsed } = useLiveState(`/api/live/state?room=${id}`, pin, { host: true });
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");
  const autoRevealed = useRef(-1);

  // after a reveal: go to the next question by itself after a countdown (can be switched off)
  const [autoNext, setAutoNextState] = useState(true);
  const [autoSecs, setAutoSecsState] = useState(10);
  const revealAt = useRef<{ index: number; at: number } | null>(null);
  const autoNexted = useRef(-1);

  useEffect(() => {
    setOrigin(location.origin);
    try {
      if (localStorage.getItem("qv_auto_next") === "off") setAutoNextState(false);
      const n = Number(localStorage.getItem("qv_auto_secs"));
      if ([5, 10, 15, 20].includes(n)) setAutoSecsState(n);
    } catch { /* private mode */ }
  }, []);
  useEffect(() => { if (s?.pin) setPin(s.pin); }, [s?.pin]);
  useTicker(s?.state === "question" || (s?.state === "reveal" && autoNext));

  const setAutoNext = (on: boolean) => {
    setAutoNextState(on);
    if (on && s?.state === "reveal") revealAt.current = { index: s.index, at: Date.now() }; // restart the countdown
    try { localStorage.setItem("qv_auto_next", on ? "on" : "off"); } catch { /* ignore */ }
  };
  const setAutoSecs = (n: number) => {
    setAutoSecsState(n);
    try { localStorage.setItem("qv_auto_secs", String(n)); } catch { /* ignore */ }
  };

  if (s?.state === "reveal" && revealAt.current?.index !== s.index) revealAt.current = { index: s.index, at: Date.now() };
  const nextIn = s?.state === "reveal" && revealAt.current
    ? Math.max(0, Math.ceil(autoSecs - (Date.now() - revealAt.current.at) / 1000)) : autoSecs;
  useEffect(() => {
    if (!s || s.state !== "reveal" || !autoNext || nextIn > 0 || busy || autoNexted.current === s.index) return;
    autoNexted.current = s.index;
    act("next");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, autoNext, nextIn, busy]);

  async function act(action: "start" | "reveal" | "next" | "end") {
    setBusy(true);
    try {
      const r = await fetch("/api/live/control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ room: id, action }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok && r.status !== 409) toast(d.error || "ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(false);
      refresh();
    }
  }

  // reveal automatically when time is up (plus network grace) or everyone has answered
  const left = s?.state === "question" ? secondsLeft() : TIME_LIMIT;
  const overtime = s?.state === "question" && elapsed() >= s.timeLimit + 1.5;
  useEffect(() => {
    if (!s || s.state !== "question" || autoRevealed.current === s.index) return;
    // team mode: members may still change their vote after reading teammates' reasons, so wait for the timer
    const allIn = !s.teamMode && s.playerCount > 0 && (s.answeredCount ?? 0) >= s.playerCount;
    // bug fix: use the real elapsed time — "left" stops at 0, so the old check never fired
    if (allIn || overtime) { autoRevealed.current = s.index; act("reveal"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, left, overtime]);

  if (!s) return <p className="loading">{error || "กำลังเปิดห้องสด…"}</p>;
  const joinUrl = `${origin}/join`;

  return (
    <section className="view">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="eyebrow">ห้องสด · หน้าจอครู</p>
          <h2 style={{ fontSize: 24 }}>{s.title}</h2>
        </div>
        <div className="row">
          {s.teamMode && <span className="pill warn">โหมดทีม (Collaborative Challenge)</span>}
          <span className="pill num">ผู้เล่น {s.playerCount} คน</span>
          {s.state !== "lobby" && s.state !== "ended" && <span className="pill num">ข้อ {s.index + 1}/{s.total}</span>}
          {s.state !== "ended" && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act("end")}>จบเกม</button>}
        </div>
      </div>
      {error && <p className="err">{error}</p>}

      {s.state === "lobby" && (
        <div className="result">
          <div className="qcard" style={{ alignItems: "center", textAlign: "center", justifyContent: "center", gap: 14 }}>
            <div className="qr-join">
              {origin && <QrCode value={`${origin}/live/${s.pin}`} size={200} label={`สแกนเพื่อเข้าห้อง ${s.pin}`} />}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                <p style={{ opacity: 0.9, fontWeight: 600 }}>สแกน QR ด้วยกล้องมือถือ เข้าห้องได้ทันที</p>
                <p style={{ opacity: 0.85 }}>หรือเข้าที่ <b style={{ overflowWrap: "anywhere" }}>{joinUrl}</b> แล้วกรอก PIN</p>
                <p className="num" style={{ font: "800 clamp(40px,8vw,76px)/1 var(--f-display)", letterSpacing: 8 }}>{s.pin}</p>
              </div>
            </div>
            <button className="btn btn-white" style={{ background: "#fff", color: "#4A2BC2" }} disabled={busy || s.playerCount === 0} onClick={() => act("start")}>
              {s.playerCount === 0 ? "รอผู้เล่นเข้าห้อง…" : `เริ่มเกม (${s.playerCount} คน) →`}
            </button>
          </div>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
            <h3 style={{ fontSize: 16 }}>ผู้เล่นในห้อง</h3>
            <div className="row" style={{ gap: 8 }}>
              {(s.players ?? []).map((n) => <span key={n} className="pill" style={{ fontSize: 14 }}>{n}</span>)}
              {!s.players?.length && <p className="small muted">ยังไม่มีใครเข้าห้อง</p>}
            </div>
            {s.teamMode && <p className="small muted">เมื่อกดเริ่ม ระบบจะแบ่งทีมละประมาณ 3 คน (2-4 ทีม) สมาชิกต้องตอบพร้อมเหตุผล ทีมตัดสินด้วยเสียงข้างมาก ได้ 1,000 เมื่อถูก +200 ถ้าทุกคนให้เหตุผล</p>}
          </div>
        </div>
      )}

      {s.state === "question" && s.question && (
        <>
          <div className="arena-top">
            <div className="row"><span className="pill">{s.question.topic}</span><span className="pill">ระดับ{LEVEL[s.question.level]}</span></div>
            <div className="progress"><i style={{ width: `${(s.index / s.total) * 100}%` }} /></div>
            <div className="timer" style={{ ["--p" as string]: `${(left / TIME_LIMIT) * 100}%` }}><span className="num">{left}</span></div>
          </div>
          <div className="qcard">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {s.question.image && <img className="qimg center" src={s.question.image} alt="รูปประกอบคำถาม" />}
            <h2>{s.question.q}</h2>
          </div>
          <div className="choices">
            {s.question.choices.map((c, i) => (
              <div key={i} className={`choice ch${i}`} style={{ cursor: "default" }}><span className="key">{KEYS[i]}</span><span>{c}</span></div>
            ))}
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="pill num" style={{ fontSize: 15 }}>ตอบแล้ว {s.answeredCount ?? 0}/{s.playerCount}{s.teamMode ? " · ทีมกำลังอภิปราย เฉลยเมื่อหมดเวลา" : ""}</span>
            <button className="btn btn-primary" disabled={busy} onClick={() => act("reveal")}>เฉลยเลย</button>
          </div>
        </>
      )}

      {s.state === "reveal" && s.reveal && (
        <div className="result">
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            <h3 style={{ fontSize: 18 }}>{s.reveal.question.q}</h3>
            <Distribution counts={s.reveal.distribution} answer={s.reveal.question.answer} choices={s.reveal.question.choices} />
            <p className="small muted">{s.reveal.question.explain}</p>
            <p className="small">
              ตอบถูก {s.reveal.distribution[s.reveal.question.answer]} จาก {s.answeredCount ?? 0} คน
              {(s.answeredCount ?? 0) > 0 && s.reveal.distribution[s.reveal.question.answer] / (s.answeredCount ?? 1) < 0.5 &&
                <span className="pill warn" style={{ marginLeft: 8 }}>ตอบถูกไม่ถึงครึ่ง ควรอธิบายข้อนี้ซ้ำ</span>}
            </p>
          </div>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            {s.teamMode && s.teamReveal ? (
              <>
                <h3 style={{ fontSize: 16 }}>คำตอบและเหตุผลของแต่ละทีม</h3>
                <TeamRevealList teams={s.teamReveal} choices={s.reveal.question.choices} />
                {s.teams && <><h3 style={{ fontSize: 16 }}>อันดับทีม</h3><TeamBoard teams={s.teams} /></>}
              </>
            ) : (
              <><h3 style={{ fontSize: 16 }}>อันดับ 5 คนแรก</h3><Leaderboard rows={s.reveal.leaderboard} /></>
            )}
            <button className="btn btn-primary" disabled={busy} onClick={() => { autoNexted.current = s.index; act("next"); }}>
              {s.index + 1 >= s.total ? "ดูผลรวม →" : "ข้อต่อไป →"}
              {autoNext && <span className="num" style={{ opacity: 0.8, fontWeight: 500 }}> (อัตโนมัติใน {nextIn} วิ)</span>}
            </button>
            {autoNext && (
              <div className="progress" aria-hidden="true">
                <i style={{ width: `${(nextIn / autoSecs) * 100}%`, transition: "width .25s linear" }} />
              </div>
            )}
            <div className="row" style={{ gap: 8, justifyContent: "space-between" }}>
              <label className="row small" style={{ gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={autoNext} onChange={(e) => setAutoNext(e.target.checked)} />
                ไปข้อต่อไปอัตโนมัติ
              </label>
              <span className="row small muted" style={{ gap: 4 }}>
                หลังเฉลย
                {[5, 10, 15, 20].map((n) => (
                  <button key={n} type="button" className={"btn btn-sm " + (autoSecs === n ? "btn-soft" : "btn-ghost")}
                    style={{ padding: "4px 10px", minWidth: 0 }} onClick={() => { setAutoSecs(n); if (autoNext) revealAt.current = { index: s.index, at: Date.now() }; }}
                    aria-pressed={autoSecs === n}>{n} วิ</button>
                ))}
              </span>
            </div>
            {!autoNext && <p className="small muted">ปิดอยู่: กด &quot;ข้อต่อไป&quot; เองเมื่ออธิบายเสร็จ</p>}
          </div>
        </div>
      )}

      {s.state === "ended" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 720, width: "100%", alignSelf: "center" }}>
          {s.teamMode && s.teams?.length ? (
            <>
              <Podium big title={`จบเกม · ${s.teams[0].name} ชนะ!`} rows={s.teams.map((t) => ({ name: t.name, score: t.score }))} />
              <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 style={{ fontSize: 16 }}>สมาชิกทีม</h3><TeamBoard teams={s.teams} />
                <h3 style={{ fontSize: 16 }}>คะแนนรายคน</h3><Leaderboard rows={s.leaderboard ?? []} />
              </div>
            </>
          ) : <Podium big title="จบเกม · อันดับรวม" rows={s.leaderboard ?? []} note={`ผู้เล่นทั้งหมด ${s.playerCount} คน`} />}
          <p className="small muted">ผลของผู้เล่นที่เข้าสู่ระบบถูกบันทึกเข้า Learning DNA แล้ว</p>
          <Link className="btn btn-ghost" href="/join" style={{ alignSelf: "flex-start" }}>กลับไปเลือกชุดข้อสอบ</Link>
        </div>
      )}
    </section>
  );
}
