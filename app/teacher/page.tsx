"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import TeacherNav, { scrollToSection } from "@/components/TeacherNav";
import { fmtDate } from "@/lib/format";
import { toast } from "@/lib/storage";
import { useMe } from "@/lib/useMe";

interface Overview {
  quizzes: { id: string; pin: string; title: string; createdAt: string; count: number; topics: string[]; soloPlays: number; liveRooms: number; isPublic: boolean; showAuthor: boolean; sharingReady: boolean }[];
  summary: { attempts: number; students: number; answers: number; accuracy: number };
  topics: { topic: string; total: number; pct: number }[];
  alerts: { kind: "question" | "topic" | "student" | "info"; text: string }[];
  recent: { key: string; name: string; source: string; at: string; score: number; correct: number; total: number }[];
}

const ALERT_LABEL = { topic: "หัวข้อ", question: "รายข้อ", student: "รายบุคคล", info: "ข้อมูล" };

/** Teacher dashboard: overview, Early Alert, weak topics and the question bank. */
export default function TeacherPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/teacher/overview", { cache: "no-store" })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); })
      .catch((e) => setErr(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"));
  }, []);
  useEffect(() => { if (me?.role === "teacher") load(); }, [me, load]);

  // /teacher#bank or #reports: scroll once the section exists, and highlight the matching menu item
  const [section, setSection] = useState<"dashboard" | "bank" | "report">("dashboard");
  useEffect(() => {
    const sync = () => {
      const h = location.hash.slice(1);
      setSection(h === "bank" ? "bank" : h === "reports" ? "report" : "dashboard");
      // wait a frame after the data renders, so nothing resets the scroll afterwards
      if (data && (h === "bank" || h === "reports")) setTimeout(() => scrollToSection(h), 120);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [data]);

  async function openLive(pin: string, teamMode = false) {
    setBusy(pin);
    const r = await fetch("/api/live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quizPin: pin, teamMode }) });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return toast(d.error || "เปิดห้องสดไม่สำเร็จ");
    router.push(`/live/host/${d.id}`);
  }

  async function share(id: string, patch: { isPublic?: boolean; showAuthor?: boolean }) {
    setBusy(id);
    const r = await fetch(`/api/teacher/quizzes/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
    setBusy(null);
    if (!r.ok) return toast((await r.json().catch(() => ({}))).error || "บันทึกไม่สำเร็จ");
    toast(patch.isPublic === true ? "แบ่งปันในหน้าแรกแล้ว" : patch.isPublic === false ? "เลิกแบ่งปันแล้ว" : "บันทึกแล้ว");
    load();
  }

  async function remove(id: string) {
    if (confirmDel !== id) { setConfirmDel(id); return; }
    setBusy(id);
    const r = await fetch(`/api/teacher/quizzes/${id}`, { method: "DELETE" });
    setBusy(null); setConfirmDel(null);
    if (!r.ok) return toast((await r.json().catch(() => ({}))).error || "ลบไม่สำเร็จ");
    toast("ลบชุดข้อสอบแล้ว");
    load();
  }

  if (loading) return <p className="loading">กำลังโหลด…</p>;
  if (me?.role !== "teacher")
    return (
      <section className="view"><div className="card" style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
        <h2 style={{ fontSize: 22 }}>แดชบอร์ดครู</h2>
        <p className="muted">หน้านี้สำหรับบัญชีครูเท่านั้น</p>
        <Link className="btn btn-primary" href="/login">เข้าสู่ระบบด้วยบัญชีครู</Link>
      </div></section>
    );

  return (
    <section className="view">
      <div className="studio">
        <TeacherNav active={section} />
        <div className="view" style={{ gap: 18 }}>
          <div><h2 style={{ fontSize: 26 }}>แดชบอร์ดครู</h2><p className="muted small">ภาพรวมผลการเรียนจากทุกชุดข้อสอบของคุณ ทั้งการเล่นเดี่ยวและห้องสด</p></div>
          {err && <p className="err">{err}</p>}
          {!data && !err && <p className="small muted">กำลังวิเคราะห์ข้อมูล…</p>}
          {data && (
            <>
              <div className="tiles">
                <div className="tile"><span className="small muted">ชุดข้อสอบ</span><b className="num">{data.quizzes.length}</b></div>
                <div className="tile"><span className="small muted">จำนวนครั้งที่เล่น</span><b className="num">{data.summary.attempts}</b></div>
                <div className="tile"><span className="small muted">นักเรียน (ไม่ซ้ำ)</span><b className="num">{data.summary.students}</b></div>
                <div className="tile"><span className="small muted">ตอบถูกเฉลี่ย</span><b className="num">{data.summary.answers ? `${data.summary.accuracy}%` : "–"}</b></div>
              </div>

              <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <h3 style={{ fontSize: 16 }}>Teacher Early Alert</h3>
                <p className="small muted">แจ้งจากรูปแบบของหลายคำตอบ ไม่ตัดสินนักเรียนจากคะแนนครั้งเดียว (รายบุคคลต้องเล่นอย่างน้อย 2 ครั้ง)</p>
                {data.alerts.length ? data.alerts.map((a, i) => (
                  <div key={i} className={`alert ${a.kind}`}><span className="pill" style={{ flex: "none" }}>{ALERT_LABEL[a.kind]}</span><span>{a.text}</span></div>
                )) : <div className="alert info"><span className="pill ok">ปกติ</span><span>ยังไม่พบหัวข้อหรือข้อที่น่ากังวล</span></div>}
              </div>

              <div className="card" id="bank" style={{ display: "flex", flexDirection: "column", gap: 12, scrollMarginTop: 90 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <h3 style={{ fontSize: 16 }}>คลังข้อสอบของฉัน</h3>
                  <Link className="btn btn-primary btn-sm" href="/studio">+ สร้างชุดใหม่</Link>
                </div>
                {!data.quizzes.length && <p className="small muted">ยังไม่มีชุดข้อสอบ สร้างใน <Link href="/studio">สร้าง Quiz</Link> แล้วกดเผยแพร่</p>}
                {data.quizzes.map((z) => (
                  <div className="room" key={z.id}>
                    <div style={{ minWidth: 0 }}>
                      <b>{z.title}</b>
                      <p className="small muted">PIN {z.pin} · {z.count} ข้อ · {z.topics.join(", ")} · เล่นเดี่ยว {z.soloPlays} ครั้ง · ห้องสด {z.liveRooms} ห้อง · สร้าง {fmtDate(z.createdAt)}</p>
                      <div className="row" style={{ gap: 8, marginTop: 6 }}>
                        <label className="approve" style={{ fontWeight: 500, fontSize: 13 }}>
                          <input type="checkbox" checked={z.isPublic} disabled={busy === z.id || !z.sharingReady} onChange={(e) => share(z.id, { isPublic: e.target.checked })} />
                          แบ่งปันในหน้าแรก
                        </label>
                        {z.isPublic && (
                          <label className="approve" style={{ fontWeight: 500, fontSize: 13 }}>
                            <input type="checkbox" checked={z.showAuthor} disabled={busy === z.id} onChange={(e) => share(z.id, { showAuthor: e.target.checked })} />
                            แสดงชื่อผู้สร้าง
                          </label>
                        )}
                        {!z.sharingReady && <span className="small muted">(รัน supabase/share.sql ก่อน)</span>}
                        {z.isPublic && <span className="pill ok">แสดงในหน้าแรก</span>}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <Link className="btn btn-soft btn-sm" href={`/teacher/quiz/${z.id}`}>รายงาน / แก้ไข</Link>
                      <button className="btn btn-primary btn-sm" disabled={busy === z.pin} onClick={() => openLive(z.pin)}>เปิดห้องสด</button>
                      <button className="btn btn-ghost btn-sm" disabled={busy === z.pin} onClick={() => openLive(z.pin, true)}>ห้องสดแบบทีม</button>
                      <button className="btn btn-ghost btn-sm" disabled={busy === z.id} onClick={() => remove(z.id)} style={confirmDel === z.id ? { color: "var(--bad)", borderColor: "var(--bad)" } : undefined}>
                        {confirmDel === z.id ? "ยืนยันลบ (ผลทั้งหมดจะหายด้วย)" : "ลบ"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div id="reports" className="view" style={{ gap: 18, scrollMarginTop: 90 }}>
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <h3 style={{ fontSize: 18 }}>รายงานผล</h3>
                  <p className="small muted">เลือกชุดข้อสอบเพื่อดูผลรายข้อ คำตอบผิดที่พบบ่อย และผลรายคน</p>
                  {!data.quizzes.length && <p className="small muted">ยังไม่มีชุดข้อสอบ</p>}
                  {data.quizzes.map((z) => (
                    <Link key={z.id} href={`/teacher/quiz/${z.id}`} className="room" style={{ textDecoration: "none", color: "inherit" }}>
                      <span style={{ minWidth: 0 }}><b>{z.title}</b> <span className="small muted">· เล่นเดี่ยว {z.soloPlays} ครั้ง · ห้องสด {z.liveRooms} ห้อง</span></span>
                      <span className="btn btn-soft btn-sm">ดูรายงาน →</span>
                    </Link>
                  ))}
                </div>

                {data.topics.length > 0 && (
                  <div className="card">
                    <h3 style={{ fontSize: 16, marginBottom: 12 }}>ความแม่นยำรายหัวข้อ (ทั้งห้อง)</h3>
                    <div className="bars">
                      {data.topics.map((t) => {
                        const color = t.pct >= 75 ? "var(--ok)" : t.pct >= 50 ? "var(--warn)" : "var(--bad)";
                        return (
                          <div className="bar" key={t.topic} style={{ gridTemplateColumns: "110px 1fr 90px" }}>
                            <span>{t.topic}</span>
                            <div className="track"><i style={{ width: `${t.pct}%`, background: color }} /></div>
                            <b className="num" style={{ textAlign: "right" }}>{t.pct}% <span className="small muted">({t.total})</span></b>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {data.recent.length > 0 && (
                  <div className="card">
                    <h3 style={{ fontSize: 16, marginBottom: 10 }}>การเล่นล่าสุด</h3>
                    <div className="table-wrap">
                      <table className="data">
                        <thead><tr><th>ผู้เล่น</th><th>แบบ</th><th>เวลา</th><th>ถูก</th><th>คะแนน</th></tr></thead>
                        <tbody>{data.recent.map((a) => (
                          <tr key={a.key}><td>{a.name}</td><td>{a.source}</td><td>{fmtDate(a.at)}</td><td className="num">{a.correct}/{a.total}</td><td className="num">{a.score.toLocaleString()}</td></tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
