"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { DB_OFF_NOTE } from "@/lib/supabase/config";

const thaiAuthError = (msg: string) => {
  if (/invalid login credentials/i.test(msg)) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if (/email not confirmed/i.test(msg)) return "ยังไม่ได้ยืนยันอีเมล ตรวจกล่องจดหมายแล้วกดลิงก์ยืนยันก่อน";
  if (/already registered|already exists/i.test(msg)) return "อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน";
  if (/password/i.test(msg) && /at least|characters|weak/i.test(msg)) return "รหัสผ่านสั้นหรือง่ายเกินไป (อย่างน้อย 6 ตัวอักษร)";
  if (/rate limit|too many/i.test(msg)) return "ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่";
  return msg;
};

export default function LoginPage() {
  const router = useRouter();
  const sb = supabaseBrowser();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sb) return;
    setErr(""); setInfo("");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("กรุณากรอกอีเมลให้ถูกต้อง");
    if (password.length < 6) return setErr("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
    if (mode === "up" && !name.trim()) return setErr("กรุณาตั้งชื่อที่จะแสดงในเกม");
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return setErr(thaiAuthError(error.message));
        router.push("/");
        router.refresh();
      } else {
        const { data, error } = await sb.auth.signUp({
          email, password,
          options: { data: { display_name: name.trim().slice(0, 40), role }, emailRedirectTo: `${location.origin}/auth/callback` },
        });
        if (error) return setErr(thaiAuthError(error.message));
        if (data.session) { router.push("/"); router.refresh(); }
        else setInfo("สมัครสำเร็จ ตรวจอีเมลแล้วกดลิงก์ยืนยัน จากนั้นกลับมาเข้าสู่ระบบ");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!sb) return <section className="view"><div className="card"><p>{DB_OFF_NOTE}</p></div></section>;

  return (
    <section className="view" style={{ alignItems: "center" }}>
      <form className="card join-card" style={{ width: "100%", maxWidth: 440 }} onSubmit={submit} noValidate>
        <div className="tabs" role="tablist" style={{ alignSelf: "flex-start" }}>
          <button type="button" role="tab" aria-selected={mode === "in"} className={mode === "in" ? "on" : ""} onClick={() => setMode("in")}>เข้าสู่ระบบ</button>
          <button type="button" role="tab" aria-selected={mode === "up"} className={mode === "up" ? "on" : ""} onClick={() => setMode("up")}>สมัครสมาชิก</button>
        </div>
        <h2 style={{ fontSize: 24 }}>{mode === "in" ? "เข้าสู่ระบบ QUIZVERSE" : "สร้างบัญชีใหม่"}</h2>
        {mode === "up" && (
          <>
            <label className="fld">ชื่อที่แสดงในเกม<input type="text" id="displayName" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} /></label>
            <div className="fld">ฉันเป็น
              <div className="row" style={{ gap: 8 }}>
                {(["student", "teacher"] as const).map((r) => (
                  <button type="button" key={r} className={"btn btn-sm " + (role === r ? "btn-primary" : "btn-ghost")} onClick={() => setRole(r)}>
                    {r === "student" ? "นักเรียน" : "ครู / ผู้สอน"}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <label className="fld">อีเมล<input type="text" id="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value.trim())} /></label>
        <label className="fld">รหัสผ่าน<input type="password" id="password" autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", border: "1.5px solid var(--line)", borderRadius: "var(--r-sm)", padding: "10px 12px", background: "var(--surface)", color: "var(--ink)" }} /></label>
        <p className="err">{err}</p>
        {info && <p className="pill ok" style={{ whiteSpace: "normal", padding: "8px 12px" }}>{info}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "กำลังดำเนินการ…" : mode === "in" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}</button>
        <p className="small muted">นักเรียนไม่ต้องสมัครก็เล่นได้ แค่ <Link href="/join">กรอก PIN</Link> แต่ถ้าสมัคร ผล Learning DNA จะถูกเก็บไว้ในบัญชี ใช้ได้ทุกเครื่อง</p>
      </form>
    </section>
  );
}
