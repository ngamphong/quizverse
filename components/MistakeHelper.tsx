"use client";
import { useState } from "react";
import { explainMistake, useAiReady } from "@/lib/ai";
import { DAY, KEYS } from "@/lib/constants";
import { fetchProfile, storeProfile } from "@/lib/profileStore";
import type { Question } from "@/lib/types";

/**
 * AI Mistake Explainer: shown after a wrong answer. Explains the mistake and
 * offers one new practice question; a wrong practice answer goes into Smart Revision.
 * Mount with a `key` per question so state resets between questions.
 */
export default function MistakeHelper({ question, choice }: { question: Question; choice: number }) {
  const aiReady = useAiReady();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [practice, setPractice] = useState<Question | null>(null);
  const [pick, setPick] = useState<number | null>(null);

  async function ask() {
    setBusy(true);
    setText("AI กำลังคิด…");
    try {
      const r = await explainMistake(question, choice);
      setText(r.explanation);
      setPractice(r.practice);
    } catch (e) {
      setText(e instanceof Error ? e.message : "เชื่อมต่อ AI ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function answerPractice(i: number) {
    if (!practice || pick !== null) return;
    setPick(i);
    if (i === practice.answer) return;
    try {
      const { profile, remote } = await fetchProfile();
      const qid = "ai:" + practice.q;
      if (!profile.revision.some((r) => r.qid === qid)) {
        profile.revision.push({ ...practice, qid, step: 0, due: Date.now() + DAY, reason: "โจทย์ฝึกจาก AI" });
        await storeProfile(profile, remote);
      }
    } catch { /* saving the practice item is best-effort */ }
  }

  if (!aiReady) return null;
  return (
    <>
      {!practice && (
        <div className="row">
          <button className="btn btn-soft btn-sm" onClick={ask} disabled={busy}>{busy ? "AI กำลังคิด…" : "AI อธิบายว่าทำไมผิด + โจทย์ฝึก"}</button>
        </div>
      )}
      {text && <div className="ai-box">{text}</div>}
      {practice && (
        <div className="ai-box" style={{ whiteSpace: "normal", display: "flex", flexDirection: "column", gap: 10 }}>
          <p><span className="pill">โจทย์ฝึกแก้จุดอ่อน</span> <b>{practice.q}</b></p>
          <div className="choice-edit">
            {practice.choices.map((c, i) => {
              const done = pick !== null;
              const style: React.CSSProperties = done && i === practice.answer ? { borderColor: "var(--ok)", background: "var(--ok-bg)" }
                : done && i === pick ? { borderColor: "var(--bad)", background: "var(--bad-bg)" } : {};
              return (
                <button key={i} className="btn btn-ghost btn-sm" style={{ justifyContent: "flex-start", color: "var(--ink)", ...style }}
                  disabled={done} onClick={() => answerPractice(i)}>{KEYS[i]}. {c}</button>
              );
            })}
          </div>
          {pick !== null && (
            <p className="small">
              {pick === practice.answer ? "ถูกต้อง! เข้าใจแล้ว " : "ยังไม่ถูก ระบบเพิ่มโจทย์นี้เข้าแผนทบทวนแล้ว "}
              <span className="muted">{practice.explain}</span>
            </p>
          )}
          <p className="small muted">คำอธิบายและโจทย์นี้สร้างโดย AI โดยอิงจากเฉลยของครู</p>
        </div>
      )}
    </>
  );
}
