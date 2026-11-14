"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import QuestionCard, { isQuestionValid } from "@/components/QuestionCard";
import TeacherNav from "@/components/TeacherNav";
import { KEYS, LEVEL, SUBJECTS } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { toast } from "@/lib/storage";
import type { Question } from "@/lib/types";
import { useMe } from "@/lib/useMe";

interface Report {
  quiz: { id: string; pin: string; title: string };
  summary: { attempts: number; students: number; answers: number; accuracy: number };
  questions: { id: string; q: string; topic: string; level: number; choices: string[]; answer: number; counts: number[]; none: number; total: number; pct: number; commonWrong: { choice: number; n: number } | null }[];
  topics: { topic: string; total: number; pct: number }[];
  attempts: { key: string; name: string; source: string; at: string; score: number; correct: number; total: number }[];
  alerts: { kind: string; text: string }[];
}

/** One quiz: results report (per question, per student) and the question editor. */
export default function TeacherQuizPage() {
  const { id } = useParams<{ id: string }>();
  const { me, loading } = useMe();
  const [tab, setTab] = useState<"report" | "edit">("report");
  const [report, setReport] = useState<Report | null>(null);
  const [title, setTitle] = useState("");
  const [qs, setQs] = useState<Question[] | null>(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [newSubject, setNewSubject] = useState(SUBJECTS[0]);

  const loadReport = useCallback(() => {
    fetch(`/api/teacher/quizzes/${id}/report`, { cache: "no-store" })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setReport(d); })
      .catch((e) => setErr(e instanceof Error ? e.message : "โหลดรายงานไม่สำเร็จ"));
  }, [id]);
  const loadQuiz = useCallback(() => {
    fetch(`/api/teacher/quizzes/${id}`, { cache: "no-store" })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setTitle(d.title); setQs(d.questions); setDirty(false); })
      .catch((e) => setErr(e instanceof Error ? e.message : "โหลดข้อสอบไม่สำเร็จ"));
  }, [id]);
  useEffect(() => { if (me?.role === "teacher") { loadReport(); loadQuiz(); } }, [me, loadReport, loadQuiz]);

  const patch = (i: number, p: Partial<Question>) => { setQs((list) => list!.map((q, j) => (j === i ? { ...q, ...p } : q))); setDirty(true); };

  async function save() {
    if (!qs) return;
    const bad = qs.findIndex((q) => !isQuestionValid(q));
    if (bad >= 0) return toast(`ข้อ ${bad + 1} ยังไม่ครบ: ต้องมีคำถาม และตัวเลือก 4 ข้อที่ไม่ซ้ำกัน`);
    if (qs.length < 3) return toast("ชุดข้อสอบต้องมีอย่างน้อย 3 ข้อ");
    setSaving(true);
    try {
      const r = await fetch(`/api/teacher/quizzes/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, questions: qs }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return toast(d.error || "บันทึกไม่สำเร็จ");
      toast(`บันทึกแล้ว ${d.count} ข้อ` + (d.removed ? ` (ลบ ${d.removed} ข้อพร้อมผลของข้อนั้น)` : ""));
      loadQuiz(); loadReport();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="loading">กำลังโหลด…</p>;
  if (me?.role !== "teacher") return <section className="view"><div className="card"><p>หน้านี้สำหรับบัญชีครูเท่านั้น · <Link href="/login">เข้าสู่ระบบ</Link></p></div></section>;

  return (
    <section className="view">
      <div className="studio">
        <TeacherNav active={tab === "report" ? "report" : "bank"} />
        <div className="view" style={{ gap: 18 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <Link className="small" href="/teacher#bank">← คลังข้อสอบ</Link>
              <h2 style={{ fontSize: 24 }}>{report?.quiz.title ?? title ?? "ชุดข้อสอบ"}</h2>
              {report && <p className="small muted">PIN เล่นเดี่ยว {report.quiz.pin}</p>}
            </div>
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={tab === "report"} className={tab === "report" ? "on" : ""} onClick={() => setTab("report")}>รายงานผล</button>
              <button role="tab" aria-selected={tab === "edit"} className={tab === "edit" ? "on" : ""} onClick={() => setTab("edit")}>แก้ไขข้อสอบ</button>
            </div>
          </div>
          {err && <p className="err">{err}</p>}

          {tab === "report" && report && (
            <>
              <div className="tiles">
                <div className="tile"><span className="small muted">จำนวนครั้งที่เล่น</span><b className="num">{report.summary.attempts}</b></div>
                <div className="tile"><span className="small muted">นักเรียน (ไม่ซ้ำ)</span><b className="num">{report.summary.students}</b></div>
                <div className="tile"><span className="small muted">คำตอบทั้งหมด</span><b className="num">{report.summary.answers}</b></div>
                <div className="tile"><span className="small muted">ตอบถูกเฉลี่ย</span><b className="num">{report.summary.answers ? `${report.summary.accuracy}%` : "–"}</b></div>
              </div>
              {report.alerts.length > 0 && (
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <h3 style={{ fontSize: 16 }}>Teacher Early Alert</h3>
                  {report.alerts.map((a, i) => <div key={i} className={`alert ${a.kind}`}>{a.text}</div>)}
                </div>
              )}
              <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 style={{ fontSize: 16 }}>ผลรายข้อ</h3>
                {report.questions.map((q, i) => {
                  const color = q.pct >= 75 ? "var(--ok)" : q.pct >= 50 ? "var(--warn)" : "var(--bad)";
                  return (
                    <div className="qstat" key={q.id}>
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <div className="row" style={{ gap: 8 }}><b>ข้อ {i + 1}</b><span className="pill">{q.topic}</span><span className="pill">{LEVEL[q.level]}</span></div>
                        <b className="num" style={{ color }}>{q.total ? `ถูก ${q.pct}%` : "ยังไม่มีคนตอบ"} <span className="small muted">({q.total} คำตอบ)</span></b>
                      </div>
                      <p>{q.q}</p>
                      <div className="row" style={{ gap: 6 }}>
                        {q.choices.map((c, j) => (
                          <span key={j} className={"pill" + (j === q.answer ? " ok" : "")} style={{ whiteSpace: "normal" }}>{KEYS[j]}. {c} · {q.counts[j]}</span>
                        ))}
                        {q.none > 0 && <span className="pill">หมดเวลา · {q.none}</span>}
                      </div>
                      {q.commonWrong && q.commonWrong.n >= 2 && (
                        <p className="small" style={{ color: "var(--warn)" }}>คำตอบผิดที่พบบ่อย: {KEYS[q.commonWrong.choice]}. {q.choices[q.commonWrong.choice]} ({q.commonWrong.n} คน) อาจเป็นความเข้าใจผิดร่วมกัน</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="card">
                <h3 style={{ fontSize: 16, marginBottom: 10 }}>ผลรายคน ({report.attempts.length} ครั้ง)</h3>
                {!report.attempts.length ? <p className="small muted">ยังไม่มีใครเล่นชุดนี้</p> : (
                  <div className="table-wrap">
                    <table className="data">
                      <thead><tr><th>ผู้เล่น</th><th>แบบ</th><th>เวลา</th><th>ถูก</th><th>%</th><th>คะแนน</th></tr></thead>
                      <tbody>{report.attempts.map((a) => (
                        <tr key={a.key}><td>{a.name}</td><td>{a.source}</td><td>{fmtDate(a.at)}</td><td className="num">{a.correct}/{a.total}</td>
                          <td className="num">{a.total ? Math.round((a.correct / a.total) * 100) : 0}%</td><td className="num">{a.score.toLocaleString()}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
          {tab === "report" && !report && !err && <p className="small muted">กำลังวิเคราะห์ผล…</p>}

          {tab === "edit" && qs && (
            <>
              <div className="card publish-bar">
                <label className="fld" style={{ flex: "1 1 260px" }}>ชื่อชุดข้อสอบ<input type="text" id="editTitle" value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} /></label>
                <button className="btn btn-primary" onClick={save} disabled={saving || !dirty}>{saving ? "กำลังบันทึก…" : dirty ? "บันทึกการแก้ไข" : "บันทึกแล้ว"}</button>
                <p className="small muted" style={{ flexBasis: "100%" }}>แก้ข้อเดิมได้โดยผลเดิมยังอยู่ ถ้าลบข้อใด ผลของข้อนั้นจะถูกลบด้วย</p>
              </div>
              <div className="grid" style={{ gap: 12 }}>
                {qs.map((q, i) => (
                  <QuestionCard key={q.id ?? `new-${i}`} index={i} value={q} canUpload
                    onChange={(p) => patch(i, p)}
                    onRemove={() => { setQs((list) => list!.filter((_, j) => j !== i)); setDirty(true); }} />
                ))}
              </div>
              <div className="row">
                <select aria-label="วิชาของข้อใหม่" style={{ width: "auto" }} value={newSubject} onChange={(e) => setNewSubject(e.target.value)}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select>
                <button className="btn btn-soft" onClick={() => { setQs((l) => [...l!, { topic: newSubject, level: 1, q: "", choices: ["", "", "", ""], answer: 0, explain: "" }]); setDirty(true); }}>+ เพิ่มคำถาม</button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
