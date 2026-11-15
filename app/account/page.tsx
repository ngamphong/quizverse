"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { loadProfile, saveProfile, toast } from "@/lib/storage";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useMe } from "@/lib/useMe";

const thaiPwError = (msg: string) => {
  if (/invalid login credentials/i.test(msg)) return "รหัสผ่านปัจจุบันไม่ถูกต้อง";
  if (/should be different|same.*password/i.test(msg)) return "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม";
  if (/at least|characters|weak/i.test(msg)) return "รหัสผ่านใหม่สั้นหรือง่ายเกินไป (อย่างน้อย 6 ตัวอักษร)";
  if (/reauthenticat|nonce/i.test(msg)) return "ระบบต้องยืนยันตัวตนเพิ่ม ออกจากระบบแล้วเข้าใหม่ จากนั้นลองอีกครั้ง";
  if (/rate limit|too many/i.test(msg)) return "ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่";
  return msg;
};

/** Account settings: display name for everyone, password for signed-in users. */
export default function AccountPage() {
  const { me, loading } = useMe();
  const sb = supabaseBrowser();
  const [name, setName] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameErr, setNameErr] = useState("");

  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState("");
  const [pwOk, setPwOk] = useState(false);

  useEffect(() => {
    if (loading) return;
    setName(me?.name ?? loadProfile().name ?? "");
  }, [loading, me?.name]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const n = name.replace(/\s+/g, " ").trim();
    setNameErr("");
    if (!n) return setNameErr("กรุณากรอกชื่อ");
    if (n.length > (me ? 40 : 20)) return setNameErr(`ชื่อยาวได้ไม่เกิน ${me ? 40 : 20} ตัวอักษร`);
    setNameBusy(true);
    try {
      if (me && sb) {
        const r = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: n }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return setNameErr(d.error ?? "บันทึกชื่อไม่สำเร็จ");
        await sb.auth.updateUser({ data: { display_name: n } }); // refreshes the name in the menu
      }
      const p = loadProfile();
      saveProfile({ ...p, name: n.slice(0, 20) });
      setName(n);
      toast("เปลี่ยนชื่อเรียบร้อย");
    } finally {
      setNameBusy(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!sb) return;
    setPwErr(""); setPwOk(false);
    if (!cur) return setPwErr("กรุณากรอกรหัสผ่านปัจจุบัน");
    if (pw.length < 6) return setPwErr("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร");
    if (pw !== pw2) return setPwErr("รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน");
    if (pw === cur) return setPwErr("รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม");
    setPwBusy(true);
    try {
      const { data: u } = await sb.auth.getUser();
      const email = u.user?.email;
      if (!email) return setPwErr("ไม่พบอีเมลของบัญชีนี้ ลองออกจากระบบแล้วเข้าใหม่");
      // confirm it is really the account owner before changing the password
      const check = await sb.auth.signInWithPassword({ email, password: cur });
      if (check.error) return setPwErr(thaiPwError(check.error.message));
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) return setPwErr(thaiPwError(error.message));
      setCur(""); setPw(""); setPw2(""); setPwOk(true);
      toast("เปลี่ยนรหัสผ่านเรียบร้อย");
    } finally {
      setPwBusy(false);
    }
  }

  if (loading) return <section className="view"><p className="muted">กำลังโหลด…</p></section>;

  return (
    <section className="view" style={{ alignItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 26 }}>ตั้งค่าบัญชี</h2>
          <p className="small muted">{me ? (me.role === "teacher" ? "บัญชีครู" : "บัญชีนักเรียน") : "ผู้เล่นทั่วไป (ไม่ได้เข้าสู่ระบบ) · ชื่อเก็บไว้ในเครื่องนี้"}</p>
        </div>

        <form className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }} onSubmit={saveName} noValidate>
          <h3 style={{ fontSize: 18 }}>เปลี่ยนชื่อ</h3>
          <label className="fld">ชื่อที่แสดงในเกม
            <input type="text" id="accName" maxLength={me ? 40 : 20} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <p className="small muted">
            {me
              ? `ใช้ในเกมเดี่ยว ห้องสด ตารางอันดับ${me.role === "teacher" ? " และชื่อผู้สร้างในข้อสอบที่แบ่งปัน" : ""} · เกมที่เล่นจบไปแล้วยังแสดงชื่อเดิม`
              : "ใช้ในเกมที่เล่นจากเครื่องนี้ (ไม่เกิน 20 ตัวอักษร)"}
          </p>
          <p className="err">{nameErr}</p>
          <button className="btn btn-primary" type="submit" disabled={nameBusy} style={{ alignSelf: "flex-start" }}>{nameBusy ? "กำลังบันทึก…" : "บันทึกชื่อ"}</button>
        </form>

        {me && sb ? (
          <form className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }} onSubmit={savePassword} noValidate>
            <h3 style={{ fontSize: 18 }}>เปลี่ยนรหัสผ่าน</h3>
            <label className="fld">รหัสผ่านปัจจุบัน
              <input type="password" id="curPw" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
            </label>
            <label className="fld">รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)
              <input type="password" id="newPw" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </label>
            <label className="fld">ยืนยันรหัสผ่านใหม่
              <input type="password" id="newPw2" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </label>
            <p className="err">{pwErr}</p>
            {pwOk && <p className="pill ok" style={{ whiteSpace: "normal", padding: "8px 12px" }}>เปลี่ยนรหัสผ่านแล้ว ครั้งหน้าใช้รหัสใหม่เข้าสู่ระบบ</p>}
            <button className="btn btn-primary" type="submit" disabled={pwBusy} style={{ alignSelf: "flex-start" }}>{pwBusy ? "กำลังเปลี่ยน…" : "เปลี่ยนรหัสผ่าน"}</button>
          </form>
        ) : (
          <div className="card" style={{ boxShadow: "none" }}>
            <p className="small muted">ต้องการเก็บผลไว้ในบัญชีและตั้งรหัสผ่าน? <Link href="/login">เข้าสู่ระบบ / สมัครสมาชิก</Link></p>
          </div>
        )}
      </div>
    </section>
  );
}
