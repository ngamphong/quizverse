"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Distribution, Leaderboard } from "@/components/LiveBoard";
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

  useEffect(() => setOrigin(location.origin), []);
  useEffect(() => { if (s?.pin) setPin(s.pin); }, [s?.pin]);
  useTicker(s?.state === "question");

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
            <p style={{ opacity: 0.85 }}>เข้าที่ <b>{joinUrl}</b> แล้วกรอก PIN</p>
            <p className="num" style={{ font: "800 clamp(44px,9vw,84px)/1 var(--f-display)", letterSpacing: 10 }}>{s.pin}</p>
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
            <button className="btn btn-primary" disabled={busy} onClick={() => act("next")}>
              {s.index + 1 >= s.total ? "ดูผลรวม →" : "ข้อต่อไป →"}
            </button>
          </div>
        </div>
      )}

      {s.state === "ended" && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 560, width: "100%", alignSelf: "center" }}>
          {s.teamMode && s.teams?.length ? (
            <><h3 style={{ fontSize: 22 }}>จบเกม · {s.teams[0].name} ชนะ!</h3><TeamBoard teams={s.teams} /><h3 style={{ fontSize: 16 }}>คะแนนรายคน</h3></>
          ) : <h3 style={{ fontSize: 22 }}>จบเกม · อันดับรวม</h3>}
          <Leaderboard rows={s.leaderboard ?? []} />
          <p className="small muted">ผลของผู้เล่นที่เข้าสู่ระบบถูกบันทึกเข้า Learning DNA แล้ว</p>
          <Link className="btn btn-ghost" href="/join">กลับไปเลือกชุดข้อสอบ</Link>
        </div>
      )}
    </section>
  );
}
