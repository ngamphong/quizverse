"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Featured { pin: string; title: string; count: number; topics: string[]; plays: number; author: string | null; sample: boolean }

const TONES = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--violet)"];
const tone = (s: string) => TONES[[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TONES.length];

/** Featured quizzes: the sample room and quizzes teachers chose to share (opt-in). */
export default function FeaturedQuizzes() {
  const [list, setList] = useState<Featured[] | null>(null);

  useEffect(() => {
    fetch("/api/featured").then((r) => r.json()).then((d) => setList(d.quizzes ?? [])).catch(() => setList([]));
  }, []);

  if (list === null)
    return <div className="qz-grid">{[0, 1, 2].map((i) => <div key={i} className="qz-card skeleton" aria-hidden="true" />)}</div>;

  if (!list.length)
    return (
      <div className="card" style={{ boxShadow: "none" }}>
        <p className="muted">ยังไม่มีข้อสอบที่แบ่งปัน ครูสามารถเลือก &quot;แบ่งปันในหน้าแรก&quot; ได้ตอนเผยแพร่ หรือในคลังข้อสอบ</p>
      </div>
    );

  return (
    <div className="qz-grid">
      {list.map((q) => (
        <article key={q.pin} className="qz-card">
          <div className="qz-band" style={{ background: `linear-gradient(135deg, ${tone(q.topics[0] ?? q.title)}, var(--indigo))` }}>
            <span className="qz-count num">{q.count} ข้อ</span>
            {q.sample && <span className="qz-flag">แนะนำ</span>}
          </div>
          <div className="qz-body">
            <h3>{q.title}</h3>
            <div className="qz-topics">
              {q.topics.slice(0, 4).map((t) => <span key={t} className="pill">{t}</span>)}
              {q.topics.length > 4 && <span className="pill">+{q.topics.length - 4}</span>}
            </div>
            <p className="small muted">
              {q.author ? `โดย ${q.author}` : "ผู้สร้างไม่ประสงค์ออกนาม"} · เล่นแล้ว {q.plays.toLocaleString()} ครั้ง
            </p>
          </div>
          <div className="qz-foot">
            <span className="small muted num">PIN {q.pin}</span>
            <Link className="btn btn-primary btn-sm" href={`/play/${q.pin}`}>เล่นเลย →</Link>
          </div>
        </article>
      ))}
    </div>
  );
}
