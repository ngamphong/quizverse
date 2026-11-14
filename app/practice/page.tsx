"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ArenaView, { type Feedback } from "@/components/ArenaView";
import MistakeHelper from "@/components/MistakeHelper";
import { TIME_LIMIT } from "@/lib/constants";
import { gradeAnswer } from "@/lib/grading";
import { applyToProfile } from "@/lib/profile";
import { fetchProfile, storeProfile } from "@/lib/profileStore";
import { toast } from "@/lib/storage";
import type { AnswerRecord, Conf, Question } from "@/lib/types";

/**
 * Smart Revision practice. Runs in the browser: it only changes the learner's
 * own Learning DNA and has no leaderboard, so server grading is not needed.
 */
export default function PracticePage() {
  const router = useRouter();
  const [items, setItems] = useState<Question[] | null>(null);
  const [remote, setRemote] = useState(false);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [conf, setConf] = useState<Conf>("sure");
  const [fb, setFb] = useState<Feedback | null>(null);
  const answers = useRef<AnswerRecord[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadline = useRef(0);
  const nextBtn = useRef<HTMLButtonElement>(null);

  const stop = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };

  useEffect(() => {
    fetchProfile().then(({ profile, remote }) => {
      const now = Date.now();
      let list = profile.revision.filter((r) => r.due <= now);
      if (!list.length) list = [...profile.revision];
      setRemote(remote);
      setItems(list.slice(0, 8).map((r) => ({ ...r })));
    });
    return stop;
  }, []);

  useEffect(() => {
    if (!items?.length || fb) return;
    deadline.current = Date.now() + TIME_LIMIT * 1000;
    setTimeLeft(TIME_LIMIT);
    stop();
    timer.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setTimeLeft(left);
      if (left <= 0) answer(-1);
    }, 250);
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, i]);

  function answer(choice: number) {
    if (!items || fb) return;
    stop();
    const q = items[i];
    const left = Math.max(0, (deadline.current - Date.now()) / 1000);
    const g = gradeAnswer(q, choice, left);
    const c: Conf = choice < 0 ? "none" : conf;
    answers.current.push({ q, choice, correct: g.correct, points: g.points, conf: c });
    setScore((s) => s + g.points);
    setFb({ correct: g.correct, choice, answer: q.answer, points: g.points, explain: q.explain, guessed: g.correct && c === "guess" });
    setTimeout(() => nextBtn.current?.focus({ preventScroll: true }), 0);
  }

  async function next() {
    if (!items) return;
    if (i + 1 < items.length) { setFb(null); setConf("sure"); setI(i + 1); return; }
    try {
      const { profile } = await fetchProfile();
      await storeProfile(applyToProfile(profile, answers.current, true), remote);
      const ok = answers.current.filter((a) => a.correct && a.conf !== "guess").length;
      toast(`ฝึกทบทวนเสร็จ ถูก ${ok}/${answers.current.length} ข้อ แผนทบทวนอัปเดตแล้ว`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "บันทึกผลไม่สำเร็จ");
    }
    router.push("/dna");
  }

  if (!items) return <p className="loading">กำลังโหลดแผนทบทวน…</p>;
  if (!items.length)
    return (
      <section className="view">
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
          <h2 style={{ fontSize: 22 }}>ยังไม่มีข้อที่ต้องทบทวน</h2>
          <p className="muted">เล่นเกมก่อน ข้อที่ตอบผิดจะถูกเพิ่มเข้าแผนทบทวนอัตโนมัติ</p>
          <Link className="btn btn-primary" href="/join">ไปหน้าเข้าร่วมเกม</Link>
        </div>
      </section>
    );

  const q = items[i];
  return (
    <ArenaView
      roomLabel="โหมดฝึกทบทวน" index={i + 1} total={items.length} topic={q.topic} level={q.level} q={q.q} choices={q.choices} image={q.image}
      score={score} timeLeft={timeLeft} conf={conf} onConf={setConf} onAnswer={answer} feedback={fb} onNext={next}
      nextRef={nextBtn} nextLabel={i + 1 >= items.length ? "บันทึกผล →" : "ข้อต่อไป →"}
    >
      {fb && !fb.correct && <MistakeHelper key={q.qid ?? q.q} question={q} choice={fb.choice} />}
    </ArenaView>
  );
}
