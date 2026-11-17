"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ArenaView, { type Feedback } from "@/components/ArenaView";
import MistakeHelper from "@/components/MistakeHelper";
import { SUBJECTS, TIME_LIMIT } from "@/lib/constants";
import { gradeAnswer } from "@/lib/grading";
import { applyToProfile } from "@/lib/profile";
import { fetchProfile, storeProfile } from "@/lib/profileStore";
import { applyQuest, PASS, QUEST_SIZE, recommend, STAGE_NAME, STAGES, stageOpen, stageStars, starsFor, subjectProgress } from "@/lib/quest";
import type { AnswerRecord, Conf, Profile, Question } from "@/lib/types";
import { useGameLock } from "@/lib/useGameLock";

type View = { kind: "map" } | { kind: "loading"; subject: string; stage: number } | { kind: "play"; subject: string; stage: number; qs: Question[] }
  | { kind: "done"; subject: string; stage: number; correct: number; stars: number; xp: number; firstClear: boolean };

const Stars = ({ n }: { n: number }) => (
  <span aria-label={`${n} ดาว`} style={{ letterSpacing: 2, color: "var(--warn)" }}>{"★".repeat(n)}<span style={{ color: "var(--line)" }}>{"★".repeat(3 - n)}</span></span>
);

/** Learning Quest: lessons as missions — 5 stages per subject, unlock, stars and XP. */
export default function QuestPage() {
  const [p, setP] = useState<Profile | null>(null);
  const [remote, setRemote] = useState(false);
  const [view, setView] = useState<View>({ kind: "map" });
  const [err, setErr] = useState("");

  const load = useCallback(() => fetchProfile().then(({ profile, remote }) => { setP(profile); setRemote(remote); }), []);
  useEffect(() => { load(); }, [load]);

  async function startStage(subject: string, stage: number) {
    setErr("");
    setView({ kind: "loading", subject, stage });
    try {
      const r = await fetch(`/api/quest?subject=${encodeURIComponent(subject)}&stage=${stage}`, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "โหลดด่านไม่สำเร็จ");
      setView({ kind: "play", subject, stage, qs: d.questions });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "โหลดด่านไม่สำเร็จ");
      setView({ kind: "map" });
    }
  }

  async function finish(subject: string, stage: number, answers: AnswerRecord[]) {
    const { profile, remote: rem } = await fetchProfile();
    const correct = answers.filter((a) => a.correct).length;
    const before = stageStars(profile, subject, stage);
    const next = applyToProfile(profile, answers, true); // stats, confidence and Smart Revision like any practice
    const xp = applyQuest(next, subject, stage, correct);
    try { await storeProfile(next, rem); } catch (e) { setErr(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ"); }
    setP(next);
    setView({ kind: "done", subject, stage, correct, stars: starsFor(correct), xp, firstClear: before === 0 && correct >= PASS });
  }

  if (!p) return <p className="loading">กำลังโหลดแผนที่ภารกิจ…</p>;

  if (view.kind === "loading")
    return <p className="loading">กำลังเตรียมด่าน {view.stage} · {view.subject}… (ครั้งแรกของด่านอาจใช้เวลาสักครู่ เพราะ AI กำลังสร้างโจทย์)</p>;

  if (view.kind === "play")
    return <QuestRun subject={view.subject} stage={view.stage} qs={view.qs} onDone={(a) => finish(view.subject, view.stage, a)} onQuit={() => setView({ kind: "map" })} />;

  if (view.kind === "done") {
    const passed = view.correct >= PASS;
    const hasNext = view.stage < 5;
    return (
      <section className="view" style={{ maxWidth: 640, width: "100%", alignSelf: "center" }}>
        <div className="qcard" style={{ alignItems: "center", textAlign: "center", gap: 10 }}>
          <p style={{ opacity: 0.85 }}>{view.subject} · ด่าน {view.stage} {STAGE_NAME[view.stage]}</p>
          <h2>{passed ? (view.firstClear ? "ผ่านด่านแล้ว!" : "ผ่านด่านอีกครั้ง!") : "ยังไม่ผ่าน ลองอีกครั้งนะ"}</h2>
          <p style={{ fontSize: 34, letterSpacing: 4 }}>{"★".repeat(view.stars)}{"☆".repeat(3 - view.stars)}</p>
          <p>ตอบถูก {view.correct}/{QUEST_SIZE} ข้อ · ได้ {view.xp} XP</p>
          {passed && view.firstClear && hasNext && <p className="pill" style={{ background: "rgba(255,255,255,.2)", color: "#fff" }}>ปลดล็อกด่าน {view.stage + 1}: {STAGE_NAME[view.stage + 1]}</p>}
          {passed && view.stage === 5 && view.firstClear && <p className="pill" style={{ background: "rgba(255,255,255,.2)", color: "#fff" }}>พิชิตบอสใหญ่วิชา{view.subject}!</p>}
        </div>
        {!passed && <p className="small muted" style={{ textAlign: "center" }}>ต้องตอบถูกอย่างน้อย {PASS} ข้อ ข้อที่ผิดถูกเพิ่มเข้าแผนทบทวนแล้ว ลองฝึกใน Learning DNA ก่อนก็ได้</p>}
        <div className="row" style={{ justifyContent: "center" }}>
          <button className="btn btn-ghost" onClick={() => setView({ kind: "map" })}>กลับแผนที่ภารกิจ</button>
          {passed && hasNext
            ? <button className="btn btn-primary" onClick={() => startStage(view.subject, view.stage + 1)}>ไปด่านต่อไป →</button>
            : <button className="btn btn-primary" onClick={() => startStage(view.subject, view.stage)}>เล่นด่านนี้อีกครั้ง</button>}
        </div>
      </section>
    );
  }

  const rec = recommend(p);
  const totalStars = SUBJECTS.reduce((t, s) => t + subjectProgress(p, s).stars, 0);
  return (
    <section className="view">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontSize: 26 }}>Learning Quest</h2>
          <p className="muted small">เปลี่ยนการทบทวนเป็นภารกิจ: วิชาละ 5 ด่านจากง่ายไปยาก ตอบถูก {PASS}/{QUEST_SIZE} ข้อเพื่อผ่านและปลดล็อกด่านถัดไป · {remote ? "บันทึกในบัญชี" : "บันทึกในเครื่องนี้"}</p>
        </div>
        <span className="pill num" style={{ fontSize: 14 }}>★ {totalStars} / {SUBJECTS.length * 15}</span>
      </div>
      {err && <p className="err">{err}</p>}

      {rec && (
        <div className="card" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ minWidth: 0 }}>
            <p className="eyebrow">ภารกิจแนะนำจาก Learning DNA</p>
            <h3 style={{ fontSize: 18 }}>{rec.subject} · ด่าน {rec.stage} {STAGE_NAME[rec.stage]}</h3>
            <p className="small muted">{rec.why}</p>
          </div>
          <button className="btn btn-primary" onClick={() => startStage(rec.subject, rec.stage)}>เริ่มภารกิจ →</button>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
        {SUBJECTS.map((s) => {
          const prog = subjectProgress(p, s);
          return (
            <div key={s} className="card" style={{ display: "flex", flexDirection: "column", gap: 10, boxShadow: "none" }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h3 style={{ fontSize: 16 }}>{s}</h3>
                <span className="small muted">ผ่าน {prog.passed}/5 · ★{prog.stars}</span>
              </div>
              <div className="xpbar"><i style={{ width: `${(prog.passed / 5) * 100}%` }} /></div>
              {STAGES.map((st) => {
                const open = stageOpen(p, s, st), stars = stageStars(p, s, st);
                return (
                  <button key={st} disabled={!open} onClick={() => startStage(s, st)} className="btn btn-ghost btn-sm"
                    style={{ justifyContent: "space-between", color: open ? "var(--ink)" : "var(--muted)", borderColor: stars ? "var(--ok)" : undefined, background: stars ? "var(--ok-bg)" : undefined }}>
                    <span>{open ? "" : "🔒 "}ด่าน {st} · {STAGE_NAME[st]}</span>
                    {stars ? <Stars n={stars} /> : <span className="small muted">{open ? "เล่น →" : "ล็อก"}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="small muted">ดาว: ถูก 3 ข้อ = ★ · 4 ข้อ = ★★ · 5 ข้อ = ★★★ ดาวใหม่ได้ 15 XP ต่อดวง ข้อที่ผิดเข้าแผนทบทวนใน <Link href="/dna">Learning DNA</Link></p>
    </section>
  );
}

/** One stage run: 5 timed questions graded in the browser (personal practice). */
function QuestRun({ subject, stage, qs, onDone, onQuit }: { subject: string; stage: number; qs: Question[]; onDone: (a: AnswerRecord[]) => void; onQuit: () => void }) {
  useGameLock(true); // leave only with the "ออกจากด่าน" button
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [conf, setConf] = useState<Conf>("sure");
  const [fb, setFb] = useState<Feedback | null>(null);
  const answers = useRef<AnswerRecord[]>([]);
  const deadline = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };

  useEffect(() => {
    if (fb) return;
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
  }, [i]);

  function answer(choice: number) {
    if (fb) return;
    stop();
    const q = qs[i];
    const g = gradeAnswer(q, choice, Math.max(0, (deadline.current - Date.now()) / 1000));
    const c: Conf = choice < 0 ? "none" : conf;
    answers.current.push({ q, choice, correct: g.correct, points: g.points, conf: c });
    setScore((s) => s + g.points);
    setFb({ correct: g.correct, choice, answer: q.answer, points: g.points, explain: q.explain, guessed: g.correct && c === "guess" });
  }

  function next() {
    if (i + 1 >= qs.length) return onDone(answers.current);
    setFb(null); setConf("sure"); setI(i + 1);
  }

  const q = qs[i];
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: -8 }}>
        <span className="small muted">Learning Quest · {subject} · ด่าน {stage} {STAGE_NAME[stage]}</span>
        <button className="btn btn-ghost btn-sm" onClick={onQuit}>ออกจากด่าน</button>
      </div>
      <ArenaView roomLabel={`ด่าน ${stage}`} index={i + 1} total={qs.length} topic={q.topic} level={q.level} q={q.q} choices={q.choices}
        score={score} timeLeft={timeLeft} conf={conf} onConf={setConf} onAnswer={answer} feedback={fb} onNext={next}
        nextLabel={i + 1 >= qs.length ? "สรุปผลด่าน →" : "ข้อต่อไป →"}>
        {fb && !fb.correct && <MistakeHelper key={q.id ?? q.q} question={q} choice={fb.choice} />}
      </ArenaView>
    </>
  );
}
