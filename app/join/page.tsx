"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadProfile, loadQuizzes, saveProfile } from "@/lib/storage";
import type { Quiz } from "@/lib/types";

export default function JoinPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    setQuizzes(loadQuizzes());
    setName(loadProfile().name);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const nm = name.trim();
    if (pin.length !== 6) return setErr("รหัสห้องต้องเป็นตัวเลข 6 หลัก");
    if (!quizzes.some((q) => q.pin === pin)) return setErr("ไม่พบห้องนี้ ตรวจสอบ PIN กับผู้สอนอีกครั้ง");
    if (!nm) return setErr("กรุณาตั้งชื่อผู้เล่น");
    setErr("");
    const p = loadProfile();
    if (p.name !== nm) saveProfile({ ...p, name: nm });
    router.push(`/play/${pin}`);
  }

  return (
    <section className="view">
      <div className="join">
        <form className="card join-card" onSubmit={submit} noValidate>
          <div>
            <h2 style={{ fontSize: 26 }}>เข้าร่วมเกม</h2>
            <p className="muted small">กรอกรหัสห้อง (Game PIN) จากผู้สอน แล้วตั้งชื่อผู้เล่น</p>
          </div>
          <label className="fld">รหัสห้อง (Game PIN)
            <input type="text" id="pin" className="pin-input num" inputMode="numeric" maxLength={6} autoComplete="off" placeholder="______"
              value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          </label>
          <label className="fld">ชื่อผู้เล่น
            <input type="text" id="playerName" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <p className="err">{err}</p>
          <button className="btn btn-primary" type="submit">เข้าร่วมเกม →</button>
          <p className="small muted">ไม่ต้องสมัครสมาชิก ผลการเล่นจะเก็บไว้ใน Learning DNA บนอุปกรณ์นี้</p>
        </form>

        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <h3 style={{ fontSize: 18 }}>ห้องที่เปิดอยู่</h3>
          <p className="small muted">ตอนนี้เล่นบนอุปกรณ์เดียว เพื่อนร่วมห้องในตารางอันดับเป็นผู้เล่นจำลอง ระบบเล่นพร้อมกันหลายเครื่องจะมาในระยะที่ 4</p>
          <div className="grid" style={{ gap: 10 }}>
            {quizzes.map((q) => (
              <div className="room" key={q.pin}>
                <div style={{ minWidth: 0 }}>
                  <b>{q.title}</b>
                  <p className="small muted">
                    {q.questions.length} ข้อ · {[...new Set(q.questions.map((x) => x.topic))].join(", ")}
                    {q.example ? " · ห้องตัวอย่าง" : ""}
                  </p>
                </div>
                <button type="button" className="btn btn-soft btn-sm num" onClick={() => setPin(q.pin)}>PIN {q.pin}</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
