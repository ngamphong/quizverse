"use client";
import { CONF_TXT, KEYS, LEVEL, TIME_LIMIT } from "@/lib/constants";
import type { Conf } from "@/lib/types";

export interface Feedback {
  correct: boolean;
  choice: number; // -1 = timed out
  answer: number;
  points: number;
  explain: string;
  /** e.g. "ข้อถัดไป: ระดับยาก ↑" */
  levelMsg?: string;
  levelUp?: boolean;
  guessed?: boolean;
}

interface Props {
  roomLabel: string;
  index: number;
  total: number;
  topic: string;
  level: number;
  q: string;
  choices: string[];
  score: number;
  timeLeft: number;
  conf: Conf;
  onConf: (c: Conf) => void;
  onAnswer: (i: number) => void;
  feedback: Feedback | null;
  onNext: () => void;
  nextLabel: string;
  busy?: boolean;
  nextRef?: React.Ref<HTMLButtonElement>;
  /** extra content under the explanation (AI Mistake Explainer) */
  children?: React.ReactNode;
}

/** The Quiz Arena screen, shared by live games (server-graded) and practice mode. */
export default function ArenaView(p: Props) {
  const fb = p.feedback;
  let explain = "";
  if (fb) {
    explain = (fb.correct ? "" : `คำตอบที่ถูกคือ ${KEYS[fb.answer]}. ${p.choices[fb.answer]} — `) + fb.explain;
    if (fb.correct && fb.guessed) explain += " (คุณเลือกว่า \"เดา\" ระบบจะนำข้อนี้กลับมาให้ทบทวนอีกครั้ง)";
  }

  return (
    <section className="view">
      <div className="arena-top">
        <div className="row">
          <span className="pill num">{p.roomLabel}</span>
          <span className="pill num">{p.index}/{p.total}</span>
          <span className="pill">ระดับ{LEVEL[p.level]}</span>
        </div>
        <div className="progress" aria-hidden="true"><i style={{ width: `${((p.index - 1) / p.total) * 100}%` }} /></div>
        <div className="timer" style={{ ["--p" as string]: `${(p.timeLeft / TIME_LIMIT) * 100}%` }} aria-label={`เหลือเวลา ${p.timeLeft} วินาที`}>
          <span className="num">{p.timeLeft}</span>
        </div>
      </div>

      <div className="qcard">
        <div className="qmeta"><span className="pill">{p.topic}</span><span className="pill num">{p.score.toLocaleString()} คะแนน</span></div>
        <h2>{p.q}</h2>
      </div>

      {!fb && (
        <div className="conf">
          <span className="muted">ความมั่นใจของคุณ:</span>
          {(["sure", "mid", "guess"] as const).map((c) => (
            <button key={c} className={p.conf === c ? "on" : ""} onClick={() => p.onConf(c)}>{CONF_TXT[c]}</button>
          ))}
        </div>
      )}

      <div className="choices">
        {p.choices.map((c, i) => {
          let cls = `choice ch${i}`;
          if (fb) cls += i === fb.answer ? " right" : i === fb.choice ? " picked-wrong" : " dim";
          return (
            <button key={i} className={cls} disabled={!!fb || p.busy} onClick={() => p.onAnswer(i)}>
              <span className="key">{KEYS[i]}</span><span>{c}</span>
            </button>
          );
        })}
      </div>

      {fb && (
        <div className={"feedback " + (fb.correct ? "good" : "bad")}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ color: fb.correct ? "var(--ok)" : "var(--bad)" }}>
              {fb.correct ? `ถูกต้อง! +${fb.points} คะแนน` : fb.choice < 0 ? "หมดเวลา" : "ยังไม่ถูก"}
            </h3>
            {fb.levelMsg && <span className="adapt" style={{ color: fb.levelUp ? "var(--ok)" : "var(--warn)" }}>{fb.levelMsg}</span>}
          </div>
          <p>{explain}</p>
          {p.children}
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button ref={p.nextRef} className="btn btn-primary" onClick={p.onNext} disabled={p.busy}>{p.nextLabel}</button>
          </div>
        </div>
      )}
    </section>
  );
}
