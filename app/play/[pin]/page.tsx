"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useState } from "react";
import { adjustLevel, pickQuestion } from "@/lib/adaptive";
import { AI_READY, explainMistake } from "@/lib/ai";
import { CONF_TXT, KEYS, LEVEL, ROUNDS, TIME_LIMIT } from "@/lib/constants";
import { gradeAnswer } from "@/lib/grading";
import { applyToProfile } from "@/lib/profile";
import { loadProfile, loadQuizzes, saveProfile, toast } from "@/lib/storage";
import type { AnswerRecord, Conf, Player, Question, Quiz } from "@/lib/types";

type Phase = "loading" | "notfound" | "question" | "feedback" | "result";

interface Game {
  quiz: Quiz;
  practice: boolean;
  pool: Question[];
  asked: Question[];
  answers: AnswerRecord[];
  level: number;
  prevLevel: number;
  maxLevel: number;
  streak: number;
  total: number;
  score: number;
  conf: Conf;
  timeLeft: number;
  cur: Question | null;
}

const BOTS: [string, number][] = [["Mild", 0.82], ["Bank", 0.74], ["Ploy", 0.66], ["Tong", 0.55], ["Fah", 0.48]];
function botScores(n: number): Player[] {
  return BOTS.map(([name, skill]) => {
    let s = 0;
    for (let i = 0; i < n; i++) if (Math.random() < skill) s += Math.round(500 + 500 * Math.random() * 0.9) + Math.floor(Math.random() * 2) * 100;
    return { name, score: s, bot: true };
  });
}

export default function PlayPage() {
  const { pin } = useParams<{ pin: string }>();
  const router = useRouter();
  const gRef = useRef<Game | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<Phase>("loading");
  const [phase, setPhaseState] = useState<Phase>("loading");
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const nextBtn = useRef<HTMLButtonElement>(null);

  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };
  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  function nextQuestion() {
    const g = gRef.current!;
    if (g.asked.length >= g.total) return finish();
    const q = pickQuestion(g.pool, g.asked, g.level, g.practice);
    g.cur = q;
    g.asked.push(q);
    g.maxLevel = Math.max(g.maxLevel, q.level);
    g.conf = "sure";
    g.timeLeft = TIME_LIMIT;
    setAiText("");
    setPhase("question");
    force();
    stopTimer();
    timerRef.current = setInterval(() => {
      const gg = gRef.current;
      if (!gg) return;
      gg.timeLeft = Math.max(0, gg.timeLeft - 1);
      force();
      if (gg.timeLeft <= 0) answer(-1);
    }, 1000);
  }

  function answer(i: number) {
    const g = gRef.current;
    if (!g || !g.cur || phaseRef.current !== "question") return;
    stopTimer();
    const q = g.cur;
    const res = gradeAnswer(q, i, g.timeLeft);
    g.score += res.points;
    g.prevLevel = g.level;
    if (!g.practice) {
      const a = adjustLevel(g.level, g.streak, res.correct);
      g.level = a.level;
      g.streak = a.streak;
    }
    g.answers.push({ q, choice: i, correct: res.correct, points: res.points, conf: i < 0 ? "none" : g.conf });
    setPhase("feedback");
    force();
    setTimeout(() => nextBtn.current?.focus({ preventScroll: true }), 0);
  }

  function finish() {
    stopTimer();
    const g = gRef.current!;
    const profile = applyToProfile(loadProfile(), g.answers, g.practice);
    saveProfile(profile);
    if (g.practice) {
      const r = g.answers.filter((a) => a.correct && a.conf !== "guess").length;
      toast(`ฝึกทบทวนเสร็จ ถูก ${r}/${g.answers.length} ข้อ แผนทบทวนอัปเดตแล้ว`);
      router.push("/dna");
      return;
    }
    setPlayerName(profile.name);
    setPlayers([...botScores(g.total), { name: profile.name, score: g.score, me: true }].sort((a, b) => b.score - a.score));
    setPhase("result");
  }

  // start the game when the page opens
  useEffect(() => {
    let quiz: Quiz | undefined;
    const practice = pin === "practice";
    if (practice) {
      const p = loadProfile();
      const now = Date.now();
      let items = p.revision.filter((r) => r.due <= now);
      if (!items.length) items = [...p.revision];
      if (items.length) quiz = { pin: "—", title: "ฝึกทบทวน", questions: items.slice(0, 8).map((r) => ({ ...r })) };
    } else {
      quiz = loadQuizzes().find((q) => q.pin === pin);
    }
    if (!quiz) { setPhase("notfound"); return; }
    const pool = quiz.questions.map((q) => ({ ...q, qid: q.qid || q.q }));
    gRef.current = {
      quiz, practice, pool, asked: [], answers: [], level: practice ? 1 : 2, prevLevel: 2, maxLevel: 1, streak: 0,
      total: practice ? pool.length : Math.min(ROUNDS, pool.length), score: 0, conf: "sure", timeLeft: TIME_LIMIT, cur: null,
    };
    nextQuestion();
    return () => { stopTimer(); gRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  // keyboard: A-D / 1-4 to answer, Enter for next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/input|textarea|select/i.test((e.target as HTMLElement).tagName)) return;
      const k = "abcd1234".indexOf(e.key.toLowerCase());
      if (k >= 0 && phaseRef.current === "question") answer(k % 4);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function askAI() {
    const g = gRef.current;
    const last = g?.answers[g.answers.length - 1];
    if (!last) return;
    setAiBusy(true);
    setAiText("AI กำลังคิด…");
    try { setAiText(await explainMistake(last.q, last.choice)); }
    catch (e) { setAiText(e instanceof Error ? e.message : "เชื่อมต่อ AI ไม่สำเร็จ"); }
    finally { setAiBusy(false); }
  }

  if (phase === "loading") return <p className="loading">กำลังเตรียมห้องเกม…</p>;
  if (phase === "notfound")
    return (
      <section className="view">
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
          <h2 style={{ fontSize: 22 }}>{pin === "practice" ? "ยังไม่มีข้อที่ต้องทบทวน" : "ไม่พบห้องเกมนี้"}</h2>
          <p className="muted">{pin === "practice" ? "เล่นเกมก่อน ข้อที่ตอบผิดจะถูกเพิ่มเข้าแผนทบทวนอัตโนมัติ" : "ตรวจสอบ PIN กับผู้สอนอีกครั้ง"}</p>
          <Link className="btn btn-primary" href="/join">ไปหน้าเข้าร่วมเกม</Link>
        </div>
      </section>
    );

  const g = gRef.current!;

  if (phase === "result") {
    const top = players.slice(0, 3);
    const right = g.answers.filter((a) => a.correct).length, n = g.answers.length;
    const guessed = g.answers.filter((a) => a.correct && a.conf === "guess").length;
    const sureWrong = g.answers.filter((a) => !a.correct && a.conf === "sure").length;
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
                  <span>{i + 1}. {p.name}{p.bot && <span style={{ opacity: 0.7, fontSize: 12 }}> (จำลอง)</span>}</span>
                  <b className="num">{p.score.toLocaleString()}</b>
                </div>
              ))}
            </div>
          </div>
          <div className="card summary">
            <p className="eyebrow">สรุปของคุณ</p>
            <div className="row"><div className="avatar">{playerName.charAt(0).toUpperCase()}</div><b style={{ fontFamily: "var(--f-display)" }}>{playerName}</b></div>
            <p className="big-score num">{g.score.toLocaleString()} คะแนน</p>
            <div>
              <div className="srow"><span>ตอบถูก</span><b className="num">{right} ข้อ</b></div>
              <div className="srow"><span>ตอบผิด</span><b className="num">{n - right} ข้อ</b></div>
              <div className="srow"><span>ความแม่นยำ</span><b className="num">{Math.round((right / n) * 100)}%</b></div>
              <div className="srow"><span>ระดับสูงสุดที่ไปถึง</span><b>{LEVEL[g.maxLevel]}</b></div>
            </div>
            <p className="small">
              {notes.length
                ? <><span className="pill warn">วิเคราะห์ความมั่นใจ</span> {notes.join(" · ")} ระบบเพิ่มข้อเหล่านี้เข้าแผนทบทวนแล้ว</>
                : <><span className="pill ok">วิเคราะห์ความมั่นใจ</span> ความมั่นใจของคุณสอดคล้องกับผลการตอบ</>}
            </p>
            <div className="row">
              <button className="btn btn-ghost" onClick={() => setShowReview((v) => !v)}>{showReview ? "ซ่อนเฉลย" : "ดูเฉลยและคำอธิบาย"}</button>
              <Link className="btn btn-primary" href="/dna">วิเคราะห์การเรียนรู้</Link>
            </div>
          </div>
        </div>
        {showReview && (
          <div className="card review">
            <h3 style={{ fontSize: 18 }}>เฉลยและคำอธิบาย</h3>
            {g.answers.map((a, i) => (
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

  // question / feedback
  const q = g.cur!;
  const last = phase === "feedback" ? g.answers[g.answers.length - 1] : null;
  let explain = "";
  if (last) {
    explain = (last.correct ? "" : `คำตอบที่ถูกคือ ${KEYS[q.answer]}. ${q.choices[q.answer]} — `) + q.explain;
    if (last.correct && last.conf === "guess") explain += " (คุณเลือกว่า \"เดา\" ระบบจะนำข้อนี้กลับมาให้ทบทวนอีกครั้ง)";
  }
  const levelMsg = !last || g.practice ? "" : g.level > g.prevLevel ? `ข้อถัดไป: ระดับ${LEVEL[g.level]} ↑` : g.level < g.prevLevel ? `ข้อถัดไป: ระดับ${LEVEL[g.level]} ↓` : "";

  return (
    <section className="view">
      <div className="arena-top">
        <div className="row">
          <span className="pill num">{g.practice ? "โหมดฝึกทบทวน" : `ห้อง ${g.quiz.pin}`}</span>
          <span className="pill num">{g.asked.length}/{g.total}</span>
          <span className="pill">ระดับ{LEVEL[q.level]}</span>
        </div>
        <div className="progress" aria-hidden="true"><i style={{ width: `${((g.asked.length - 1) / g.total) * 100}%` }} /></div>
        <div className="timer" style={{ ["--p" as string]: `${(g.timeLeft / TIME_LIMIT) * 100}%` }} aria-label={`เหลือเวลา ${g.timeLeft} วินาที`}>
          <span className="num">{g.timeLeft}</span>
        </div>
      </div>

      <div className="qcard">
        <div className="qmeta"><span className="pill">{q.topic}</span><span className="pill num">{g.score.toLocaleString()} คะแนน</span></div>
        <h2>{q.q}</h2>
      </div>

      {phase === "question" && (
        <div className="conf">
          <span className="muted">ความมั่นใจของคุณ:</span>
          {(["sure", "mid", "guess"] as const).map((c) => (
            <button key={c} className={g.conf === c ? "on" : ""} onClick={() => { g.conf = c; force(); }}>{CONF_TXT[c]}</button>
          ))}
        </div>
      )}

      <div className="choices">
        {q.choices.map((c, i) => {
          let cls = `choice ch${i}`;
          if (last) cls += i === q.answer ? " right" : i === last.choice ? " picked-wrong" : " dim";
          return (
            <button key={i} className={cls} disabled={!!last} onClick={() => answer(i)}>
              <span className="key">{KEYS[i]}</span><span>{c}</span>
            </button>
          );
        })}
      </div>

      {last && (
        <div className={"feedback " + (last.correct ? "good" : "bad")}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ color: last.correct ? "var(--ok)" : "var(--bad)" }}>
              {last.correct ? `ถูกต้อง! +${last.points} คะแนน` : last.choice < 0 ? "หมดเวลา" : "ยังไม่ถูก"}
            </h3>
            {levelMsg && <span className="adapt" style={{ color: g.level > g.prevLevel ? "var(--ok)" : "var(--warn)" }}>{levelMsg}</span>}
          </div>
          <p>{explain}</p>
          {!last.correct && AI_READY && (
            <div className="row">
              <button className="btn btn-soft btn-sm" onClick={askAI} disabled={aiBusy}>AI อธิบายว่าทำไมผิด</button>
            </div>
          )}
          {aiText && <div className="ai-box">{aiText}</div>}
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button ref={nextBtn} className="btn btn-primary" onClick={nextQuestion}>
              {g.asked.length >= g.total ? "ดูผลการเล่น →" : "ข้อต่อไป →"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
