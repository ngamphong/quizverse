"use client";
import Link from "next/link";
import { useState } from "react";
import { CONF_TXT, LEVEL } from "@/lib/constants";
import type { GameResult } from "@/lib/types";

/** Podium, leaderboard, personal summary and answer review after a game. */
export default function ResultView({ result }: { result: GameResult }) {
  const [showReview, setShowReview] = useState(false);
  const { players, answers, name } = result;
  const top = players.slice(0, 3);
  const n = answers.length || 1;
  const right = answers.filter((a) => a.correct).length;
  const guessed = answers.filter((a) => a.correct && a.conf === "guess").length;
  const sureWrong = answers.filter((a) => !a.correct && a.conf === "sure").length;
  const notes = [guessed ? `ตอบถูกแต่เดา ${guessed} ข้อ` : "", sureWrong ? `มั่นใจแต่ตอบผิด ${sureWrong} ข้อ (อาจเข้าใจคลาดเคลื่อน)` : ""].filter(Boolean);

  return (
    <section className="view">
      <div className="result">
        <div className="podium-wrap">
          <h2 style={{ fontSize: 26 }}>ผลการเล่นเกม</h2>
          <div className="podium">
            {[1, 0, 2].filter((i) => top[i]).map((i) => (
              <div key={i} className={`pod p${i + 1}${top[i].me ? " me" : ""}`}>
                <span className="who">{top[i].name}</span>
                <span className="pts num">{top[i].score.toLocaleString()} คะแนน</span>
                <div className="block">{i + 1}</div>
              </div>
            ))}
          </div>
          <div className="lb">
            {players.map((p, i) => (
              <div key={p.name + i} className={p.me ? "me" : ""}>
                <span>{p.rank && <span style={{ opacity: 0.6 }}>⋯ </span>}{p.rank ?? i + 1}. {p.name}{p.bot && <span style={{ opacity: 0.7, fontSize: 12 }}> (จำลอง)</span>}</span>
                <b className="num">{p.score.toLocaleString()}</b>
              </div>
            ))}
          </div>
          {result.playerCount !== undefined && (
            <p className="small" style={{ opacity: 0.85, marginTop: 10 }}>
              {result.playerCount > 1
                ? `อันดับจากนักเรียนที่เล่นชุดนี้ ${result.playerCount.toLocaleString()} คน (คะแนนดีที่สุดของแต่ละคน)`
                : "คุณเป็นคนแรกที่เล่นชุดนี้ ชวนเพื่อนมาเล่นด้วย PIN เดียวกันเพื่อแข่งอันดับ"}
            </p>
          )}
        </div>
        <div className="card summary">
          <p className="eyebrow">สรุปของคุณ</p>
          <div className="row"><div className="avatar">{name.charAt(0).toUpperCase()}</div><b style={{ fontFamily: "var(--f-display)" }}>{name}</b></div>
          <p className="big-score num">{result.score.toLocaleString()} คะแนน</p>
          <div>
            <div className="srow"><span>ตอบถูก</span><b className="num">{right} ข้อ</b></div>
            <div className="srow"><span>ตอบผิด</span><b className="num">{answers.length - right} ข้อ</b></div>
            <div className="srow"><span>ความแม่นยำ</span><b className="num">{Math.round((right / n) * 100)}%</b></div>
            <div className="srow"><span>ระดับสูงสุดที่ไปถึง</span><b>{LEVEL[result.maxLevel]}</b></div>
          </div>
          <p className="small">
            {notes.length
              ? <><span className="pill warn">วิเคราะห์ความมั่นใจ</span> {notes.join(" · ")} ระบบเพิ่มข้อเหล่านี้เข้าแผนทบทวนแล้ว</>
              : <><span className="pill ok">วิเคราะห์ความมั่นใจ</span> ความมั่นใจของคุณสอดคล้องกับผลการตอบ</>}
          </p>
          <p className="small muted">คะแนนตรวจโดยเซิร์ฟเวอร์ และจับเวลาจากเซิร์ฟเวอร์</p>
          <div className="row">
            <button className="btn btn-ghost" onClick={() => setShowReview((v) => !v)}>{showReview ? "ซ่อนเฉลย" : "ดูเฉลยและคำอธิบาย"}</button>
            <Link className="btn btn-primary" href="/dna">วิเคราะห์การเรียนรู้</Link>
          </div>
        </div>
      </div>
      {showReview && (
        <div className="card review">
          <h3 style={{ fontSize: 18 }}>เฉลยและคำอธิบาย</h3>
          {answers.map((a, i) => (
            <div key={i} className={"rv " + (a.correct ? "okk" : "wrong")}>
              <div className="row" style={{ gap: 8 }}>
                <b>ข้อ {i + 1}</b><span className="pill">{a.q.topic}</span><span className="pill">{LEVEL[a.q.level]}</span>
                <span className={"pill " + (a.correct ? "ok" : "bad")}>{a.correct ? "ถูก" : "ผิด"}</span>
                <span className="small muted">ความมั่นใจ: {CONF_TXT[a.conf]}</span>
              </div>
              <p style={{ fontWeight: 600 }}>{a.q.q}</p>
              <p className="small">คุณตอบ: {a.choice < 0 ? "ไม่ได้ตอบ" : a.q.choices[a.choice]} · เฉลย: <b>{a.q.choices[a.q.answer]}</b></p>
              <p className="small muted">{a.q.explain}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
