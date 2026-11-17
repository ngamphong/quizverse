"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ArenaView, { type Feedback } from "@/components/ArenaView";
import MistakeHelper from "@/components/MistakeHelper";
import ResultView from "@/components/ResultView";
import { LEVEL, TIME_LIMIT } from "@/lib/constants";
import { applyToProfile } from "@/lib/profile";
import { play } from "@/lib/sound";
import { loadProfile, saveProfile } from "@/lib/storage";
import type { ClientQuestion, Conf, GameResult, Question } from "@/lib/types";
import { useMe } from "@/lib/useMe";

type Phase = "loading" | "error" | "question" | "feedback" | "result";

async function api<T>(path: string, body: object): Promise<T> {
  let r: Response;
  try {
    r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่");
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "เกิดข้อผิดพลาด");
  return d as T;
}

interface Start { sessionId: string; token: string; title: string; pin: string; total: number; index: number; score: number; question: ClientQuestion }
interface Answered { correct: boolean; choice: number; answer: number; explain: string; points: number; score: number; level: number; prevLevel: number; done: boolean; question: Question }
type Next = { done: false; index: number; total: number; score: number; question: ClientQuestion } | { done: true; result: GameResult };

/** Live game: every answer is graded and timed by the server (/api/game/*). */
export default function PlayPage() {
  const { pin } = useParams<{ pin: string }>();
  const { me, loading: meLoading } = useMe();
  const [phase, setPhaseState] = useState<Phase>("loading");
  const [err, setErr] = useState("");
  const [q, setQ] = useState<ClientQuestion | null>(null);
  const [index, setIndex] = useState(1);
  const [total, setTotal] = useState(1);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [conf, setConf] = useState<Conf>("sure");
  const [fb, setFb] = useState<Feedback | null>(null);
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [busy, setBusy] = useState(false);

  const session = useRef<{ id: string; token: string } | null>(null);
  const phaseRef = useRef<Phase>("loading");
  const confRef = useRef<Conf>("sure");
  const busyRef = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const started = useRef(false);
  const nextBtn = useRef<HTMLButtonElement>(null);

  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };
  const stopTimer = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };

  const submit = useCallback(async (choice: number) => {
    if (phaseRef.current !== "question" || busyRef.current || !session.current) return;
    busyRef.current = true; setBusy(true);
    if (choice >= 0) setPending(choice); // show the pick at once; grading comes back from the server
    stopTimer();
    try {
      const a = await api<Answered>("/api/game/answer", { sessionId: session.current.id, token: session.current.token, choice, conf: confRef.current });
      setAnswered(a);
      setScore(a.score);
      setFb({
        correct: a.correct, choice: a.choice, answer: a.answer, points: a.points, explain: a.explain,
        guessed: a.correct && confRef.current === "guess",
        levelUp: a.level > a.prevLevel,
        levelMsg: a.level > a.prevLevel ? `ข้อถัดไป: ระดับ${LEVEL[a.level]} ↑` : a.level < a.prevLevel ? `ข้อถัดไป: ระดับ${LEVEL[a.level]} ↓` : "",
      });
      setPhase("feedback");
      setTimeout(() => nextBtn.current?.focus({ preventScroll: true }), 0);
    } catch (e) {
      setPending(null);
      setErr(e instanceof Error ? e.message : "ส่งคำตอบไม่สำเร็จ");
      setPhase("error");
    } finally {
      busyRef.current = false; setBusy(false);
    }
  }, []);

  const showQuestion = useCallback((question: ClientQuestion) => {
    setQ(question); setFb(null); setAnswered(null); setPending(null);
    confRef.current = "sure"; setConf("sure");
    setTimeLeft(TIME_LIMIT);
    setPhase("question");
    stopTimer();
    const until = Date.now() + TIME_LIMIT * 1000;
    timer.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setTimeLeft(left);
      if (left <= 0) submit(-1);
    }, 250);
  }, [submit]);

  // start once (guards against React StrictMode running effects twice in dev)
  useEffect(() => {
    if (started.current || meLoading) return;
    started.current = true;
    api<Start>("/api/game/start", { pin, nickname: loadProfile().name })
      .then((s) => {
        session.current = { id: s.sessionId, token: s.token };
        setTotal(s.total); setIndex(s.index); setScore(s.score);
        showQuestion(s.question);
      })
      .catch((e) => { setErr(e instanceof Error ? e.message : "เริ่มเกมไม่สำเร็จ"); setPhase("error"); });
  }, [pin, meLoading, showQuestion]);

  useEffect(() => () => stopTimer(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/input|textarea|select/i.test((e.target as HTMLElement).tagName)) return;
      const k = "abcd1234".indexOf(e.key.toLowerCase());
      if (k >= 0 && phaseRef.current === "question") submit(k % 4);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit]);

  async function next() {
    if (!session.current || busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      const n = await api<Next>("/api/game/next", { sessionId: session.current.id, token: session.current.token });
      if (n.done) {
        // signed-in players: the server already updated Learning DNA; guests keep it in this browser
        if (!me) saveProfile(applyToProfile(loadProfile(), n.result.answers, false));
        setResult(n.result);
        play("finish");
        setPhase("result");
      } else {
        setIndex(n.index); setTotal(n.total); setScore(n.score);
        showQuestion(n.question);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "โหลดข้อถัดไปไม่สำเร็จ");
      setPhase("error");
    } finally {
      busyRef.current = false; setBusy(false);
    }
  }

  if (phase === "loading") return <p className="loading">กำลังเตรียมห้องเกม…</p>;
  if (phase === "error")
    return (
      <section className="view">
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
          <h2 style={{ fontSize: 22 }}>เล่นต่อไม่ได้</h2>
          <p className="muted">{err}</p>
          <Link className="btn btn-primary" href="/join">กลับไปหน้าเข้าร่วมเกม</Link>
        </div>
      </section>
    );
  if (phase === "result" && result) return <ResultView result={result} />;
  if (!q) return null;

  return (
    <ArenaView
      roomLabel={`ห้อง ${pin}`} index={index} total={total} topic={q.topic} level={q.level} q={q.q} choices={q.choices} image={q.image}
      score={score} timeLeft={timeLeft} conf={conf} onConf={(c) => { confRef.current = c; setConf(c); }}
      onAnswer={submit} feedback={fb} onNext={next} busy={busy} pending={pending} nextRef={nextBtn}
      nextLabel={answered?.done ? "ดูผลการเล่น →" : "ข้อต่อไป →"}
    >
      {answered && !answered.correct && <MistakeHelper key={answered.question.id} question={answered.question} choice={answered.choice} />}
    </ArenaView>
  );
}
