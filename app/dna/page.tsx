"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import RadarChart from "@/components/RadarChart";
import { studyCoach, useAiReady } from "@/lib/ai";
import { DAY, INTERVALS, SUBJECTS } from "@/lib/constants";
import { emptyProfile, lvOf, pct, XP_PER_LEVEL } from "@/lib/profile";
import { fetchProfile, storeProfile } from "@/lib/profileStore";
import { toast } from "@/lib/storage";
import type { Profile } from "@/lib/types";

export default function DnaPage() {
  const router = useRouter();
  const [p, setP] = useState<Profile | null>(null);
  const [remote, setRemote] = useState(false);
  const [now, setNow] = useState(0);
  const [coach, setCoach] = useState("");
  const [coachBusy, setCoachBusy] = useState(false);
  const aiReady = useAiReady();

  useEffect(() => {
    fetchProfile().then(({ profile, remote }) => { setP(profile); setRemote(remote); setNow(Date.now()); });
  }, []);
  if (!p) return <p className="loading">กำลังโหลดโปรไฟล์…</p>;

  const vals = SUBJECTS.map((s) => pct(p.stats[s]));
  const ranked = SUBJECTS.map((s, i) => ({ s, v: vals[i], n: p.stats[s]?.total || 0 })).filter((x) => x.n);
  const strong = ranked.filter((x) => x.v >= 75).sort((a, b) => b.v - a.v);
  const weak = ranked.filter((x) => x.v < 70).sort((a, b) => a.v - b.v);
  const lv = lvOf(p.xp), base = (lv - 1) * XP_PER_LEVEL;
  const rev = [...p.revision].sort((a, b) => a.due - b.due);
  const dueN = rev.filter((r) => r.due <= now).length;

  const badges: [string, string, string, boolean][] = [
    ["1", "ก้าวแรก", "เล่นเกมแรกสำเร็จ", p.games >= 1],
    ["+", "พัฒนาการก้าวกระโดด", "วิชาใดวิชาหนึ่งเพิ่มขึ้น 10 จุดขึ้นไป",
      p.bestJump >= 10 || SUBJECTS.some((s) => { const h = p.stats[s]?.hist || []; return h.length >= 2 && h[h.length - 1] - h[0] >= 10; })],
    ["✓", "แก้จุดอ่อนสำเร็จ", "ทบทวนข้อที่เคยผิดจนผ่านครบ 4 รอบ", p.mastered >= 1],
    ["7", "ต่อเนื่อง 7 วัน", "เรียนติดต่อกัน 7 วัน", p.streak >= 7],
    ["★", "เข้าใจรอบด้าน", "ทุกวิชาได้ 70% ขึ้นไป", SUBJECTS.every((s) => pct(p.stats[s]) >= 70)],
  ];

  async function clearExample() {
    const fresh = emptyProfile(p!.name);
    await storeProfile(fresh, remote);
    setP(fresh);
    toast("ล้างข้อมูลตัวอย่างแล้ว เริ่มเก็บผลจากการเล่นจริง");
  }

  async function askCoach() {
    // scores only — the student's name is never sent to the AI
    const subjects = SUBJECTS.map((s) => {
      const st = p!.stats[s];
      return `${s}: ${pct(st)}% (${st?.total || 0} ข้อ, ผลรายเกม ${(st?.hist || []).join(", ") || "-"})`;
    }).join("\n");
    const revs = p!.revision.slice(0, 6).map((r) => `- [${r.topic}] ${r.q} (${r.reason})`).join("\n") || "-";
    const summary = `${subjects}\nมั่นใจแต่ตอบผิด ${p!.conf.sureWrong} ครั้ง, ตอบถูกแต่เดา ${p!.conf.guessRight} ครั้ง\nข้อที่รอทบทวน:\n${revs}`;
    setCoachBusy(true);
    setCoach("AI กำลังวิเคราะห์ผลของคุณ…");
    try { setCoach(await studyCoach(summary)); }
    catch (e) { setCoach(e instanceof Error ? e.message : "เชื่อมต่อ AI ไม่สำเร็จ"); }
    finally { setCoachBusy(false); }
  }

  return (
    <section className="view">
      {p.example && (
        <div className="example-note">
          <span>ข้อมูลในหน้านี้เป็นตัวอย่าง เพื่อให้เห็นภาพการทำงาน ผลจากการเล่นจริงจะถูกรวมเข้ามาทันที</span>
          <button className="btn btn-sm btn-ghost" onClick={clearExample}>ล้างข้อมูลตัวอย่าง</button>
        </div>
      )}
      <div className="dna">
        <div className="card profile">
          <div className="avatar">{p.name.charAt(0).toUpperCase()}</div>
          <div><h3>{p.name}</h3><p className="small muted">Lv. {lv}</p></div>
          <div style={{ width: "100%" }}>
            <div className="xpbar"><i style={{ width: `${((p.xp - base) / XP_PER_LEVEL) * 100}%` }} /></div>
            <p className="small muted num" style={{ marginTop: 4 }}>XP {p.xp.toLocaleString()} / {(lv * XP_PER_LEVEL).toLocaleString()}</p>
          </div>
          <div className="streak">เรียนต่อเนื่อง {p.streak} วัน</div>
          <div className="small muted">เล่นแล้ว {p.games} เกม · ทบทวนสำเร็จ {p.mastered} ข้อ</div>
        </div>

        <div className="view" style={{ gap: 18 }}>
          <div>
            <h2 style={{ fontSize: 26 }}>โปรไฟล์การเรียนรู้ของฉัน (Learning DNA)</h2>
            <p className="muted small">
              รวมผลจากทุกเกมและการฝึกทบทวน เพื่อบอกว่าเก่งเรื่องไหน และควรฝึกเรื่องใดต่อ ·{" "}
              {remote ? "บันทึกในบัญชีของคุณ ใช้ได้ทุกเครื่อง" : "บันทึกในเครื่องนี้เท่านั้น (เข้าสู่ระบบเพื่อเก็บในบัญชี)"}
            </p>
          </div>

          <div className="dna-main">
            <div className="card radar">
              <h3 style={{ fontSize: 16, marginBottom: 6 }}>ความสามารถรายหัวข้อ</h3>
              <RadarChart labels={SUBJECTS} values={vals} />
            </div>
            <div className="card sw">
              <h3 style={{ fontSize: 16 }}>จุดแข็ง และจุดที่ควรพัฒนา</h3>
              {!ranked.length ? (
                <p className="muted small">ยังไม่มีข้อมูล เล่นเกมหรือฝึกทบทวนอย่างน้อย 1 ครั้ง แล้วผลวิเคราะห์จะขึ้นที่นี่</p>
              ) : (
                <>
                  <div className="sw-box ok"><h4>จุดแข็ง</h4>
                    {strong.length ? <ul>{strong.map((x) => <li key={x.s}>{x.s} ({x.v}%)</li>)}</ul> : <p className="small">ยังไม่มีวิชาที่ได้ 75% ขึ้นไป</p>}
                  </div>
                  <div className="sw-box bad"><h4>ควรพัฒนา</h4>
                    {weak.length ? <ul>{weak.map((x) => <li key={x.s}>{x.s} ({x.v}%)</li>)}</ul> : <p className="small">ไม่มีวิชาที่ต่ำกว่า 70%</p>}
                  </div>
                  <p className="small muted">มั่นใจแต่ตอบผิด {p.conf.sureWrong} ครั้ง · ตอบถูกแต่เดา {p.conf.guessRight} ครั้ง</p>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>ความแม่นยำรายวิชา</h3>
            <div className="bars">
              {SUBJECTS.map((s, i) => {
                const v = vals[i], st = p.stats[s] || { total: 0, hist: [] }, h = st.hist || [];
                const trend = h.length >= 2 ? h[h.length - 1] - h[0] : 0;
                const color = v >= 75 ? "var(--ok)" : v >= 60 ? "var(--warn)" : "var(--bad)";
                return (
                  <div key={s} style={{ display: "contents" }}>
                    <div className="bar">
                      <span>{s}</span>
                      <div className="track" title={`${st.total} ข้อ`}><i style={{ width: `${v}%`, background: color }} /></div>
                      <b className="num" style={{ textAlign: "right" }}>{st.total ? `${v}%` : "–"}</b>
                    </div>
                    {trend !== 0 && <p className="small muted trend">{trend > 0 ? `พัฒนาขึ้น ${trend}` : `ลดลง ${Math.abs(trend)}`} จุด เทียบกับเกมแรกที่บันทึก</p>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <h3 style={{ fontSize: 16 }}>แผนทบทวนอัตโนมัติ (Smart Revision)</h3>
                <p className="small muted">ข้อที่เคยตอบผิด หรือตอบถูกแต่เดา จะกลับมาให้ฝึกซ้ำหลัง {INTERVALS.join(", ")} วัน</p>
              </div>
              <button className="btn btn-primary" disabled={!rev.length} onClick={() => router.push("/practice")}>
                {dueN ? `ฝึกทบทวนตอนนี้ (${dueN} ข้อถึงกำหนด)` : rev.length ? "ฝึกล่วงหน้าทั้งหมด" : "ฝึกทบทวนตอนนี้"}
              </button>
            </div>
            <div>
              {!rev.length ? (
                <p className="muted small">ยังไม่มีข้อที่ต้องทบทวน ข้อที่ตอบผิดจากเกมถัดไปจะถูกเพิ่มที่นี่อัตโนมัติ</p>
              ) : rev.map((r) => (
                <div className="rev-item" key={r.qid}>
                  <div style={{ minWidth: 0, flex: "1 1 260px" }}>
                    <span className="small muted">{r.topic} · {r.reason} · รอบที่ {r.step + 1}/{INTERVALS.length}</span>
                    <p>{r.q}</p>
                  </div>
                  {r.due <= now ? <span className="pill bad">ถึงกำหนดแล้ว</span> : <span className="pill">อีก {Math.ceil((r.due - now) / DAY)} วัน</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <h3 style={{ fontSize: 16 }}>AI Study Coach</h3>
                <p className="small muted">{aiReady === false ? "ยังไม่พร้อม: ผู้ดูแลต้องตั้งค่า GEMINI_API_KEY ก่อน" : "ให้ AI อ่านผลของคุณแล้วเขียนแผนเรียนสั้นๆ สำหรับสัปดาห์นี้ (ส่งเฉพาะคะแนน ไม่ส่งชื่อ)"}</p>
              </div>
              <button className="btn btn-soft" onClick={askCoach} disabled={!aiReady || coachBusy}>{coachBusy ? "AI กำลังเขียนแผน…" : "ขอแผนการเรียนจาก AI"}</button>
            </div>
            {coach && <div className="ai-box">{coach}</div>}
          </div>

          <div className="card">
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>รางวัลจากพัฒนาการ (Mastery Rewards)</h3>
            <div className="badges">
              {badges.map(([m, t, d, on]) => (
                <div key={t} className={"badge" + (on ? "" : " locked")}>
                  <span className="medal">{m}</span>
                  <div><b>{t}</b><p className="small muted">{d}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
