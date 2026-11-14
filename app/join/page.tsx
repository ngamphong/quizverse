"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadProfile, saveProfile } from "@/lib/storage";
import { useMe } from "@/lib/useMe";

interface Room { pin: string; title: string; count: number; topics: string[]; sample: boolean }

export default function JoinPage() {
  const router = useRouter();
  const { me } = useMe();
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [roomsErr, setRoomsErr] = useState("");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    setName(loadProfile().name);
    fetch("/api/quizzes", { cache: "no-store" })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setRooms(d.rooms); })
      .catch((e) => { setRooms([]); setRoomsErr(e instanceof Error ? e.message : "โหลดรายชื่อห้องไม่สำเร็จ"); });
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const nm = (me?.name ?? name).trim();
    if (pin.length !== 6) return setErr("รหัสห้องต้องเป็นตัวเลข 6 หลัก");
    if (!nm) return setErr("กรุณาตั้งชื่อผู้เล่น");
    setErr("");
    const p = loadProfile();
    if (!me && p.name !== nm) saveProfile({ ...p, name: nm });
    router.push(`/play/${pin}`); // the server checks the PIN when the game starts
  }

  return (
    <section className="view">
      <div className="join">
        <form className="card join-card" onSubmit={submit} noValidate>
          <div>
            <h2 style={{ fontSize: 26 }}>เข้าร่วมเกม</h2>
            <p className="muted small">กรอกรหัสห้อง (Game PIN) จากผู้สอน{me ? "" : " แล้วตั้งชื่อผู้เล่น"}</p>
          </div>
          <label className="fld">รหัสห้อง (Game PIN)
            <input type="text" id="pin" className="pin-input num" inputMode="numeric" maxLength={6} autoComplete="off" placeholder="______"
              value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          </label>
          {me ? (
            <p className="small">เล่นในชื่อ <b>{me.name}</b> ผลจะบันทึกเข้า Learning DNA ในบัญชีของคุณ</p>
          ) : (
            <label className="fld">ชื่อผู้เล่น
              <input type="text" id="playerName" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          )}
          <p className="err">{err}</p>
          <button className="btn btn-primary" type="submit">เข้าร่วมเกม →</button>
          {!me && <p className="small muted">ไม่ต้องสมัครสมาชิก ผลจะเก็บไว้ในเครื่องนี้ หรือ <Link href="/login">เข้าสู่ระบบ</Link> เพื่อเก็บไว้ในบัญชี</p>}
        </form>

        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <h3 style={{ fontSize: 18 }}>{me?.role === "teacher" ? "ห้องตัวอย่าง และห้องของคุณ" : "ห้องตัวอย่าง"}</h3>
          <p className="small muted">คะแนนตรวจและจับเวลาโดยเซิร์ฟเวอร์ เพื่อนร่วมห้องในตารางอันดับยังเป็นผู้เล่นจำลอง จนกว่าจะถึงระยะที่ 4 (เล่นพร้อมกันหลายเครื่อง)</p>
          {roomsErr && <p className="err">{roomsErr}</p>}
          {rooms === null && <p className="small muted">กำลังโหลด…</p>}
          <div className="grid" style={{ gap: 10 }}>
            {rooms?.map((r) => (
              <div className="room" key={r.pin}>
                <div style={{ minWidth: 0 }}>
                  <b>{r.title}</b>
                  <p className="small muted">{r.count} ข้อ · {r.topics.join(", ")}{r.sample ? " · ห้องตัวอย่าง" : ""}</p>
                </div>
                <button type="button" className="btn btn-soft btn-sm num" onClick={() => setPin(r.pin)}>PIN {r.pin}</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
