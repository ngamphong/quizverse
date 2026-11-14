"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AI_OFF_NOTE, generateQuestions, useAiReady } from "@/lib/ai";
import { KEYS, LEVEL, SUBJECTS } from "@/lib/constants";
import { loadDrafts, saveDrafts, toast } from "@/lib/storage";
import type { Draft } from "@/lib/types";
import { useMe } from "@/lib/useMe";

type Src = "file" | "topic" | "text";
const isValid = (d: Draft) => d.q.trim() !== "" && d.choices.every((c) => c.trim() !== "");

export default function StudioPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<"ai" | "manual">("ai");
  const [src, setSrc] = useState<Src>("topic");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [manSubject, setManSubject] = useState(SUBJECTS[0]);
  const [count, setCount] = useState(5);
  const [level, setLevel] = useState<"mix" | "1" | "2" | "3">("mix");
  const [topic, setTopic] = useState("ระบบสุริยะและการเคลื่อนที่ของโลก");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState("รองรับ .pdf .docx .txt .md ขนาดไม่เกิน 4 MB");
  const [busy, setBusy] = useState(false);
  const aiReady = useAiReady();
  const { me } = useMe();
  const [publishing, setPublishing] = useState(false);
  const [title, setTitle] = useState("ทบทวนบทเรียน");
  const [publishErr, setPublishErr] = useState("");
  const [publishedPin, setPublishedPin] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setDrafts(loadDrafts()); setLoaded(true); }, []);
  useEffect(() => { if (loaded) saveDrafts(drafts); }, [drafts, loaded]);

  const update = (i: number, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d, j) => {
      if (j !== i) return d;
      const next = { ...d, ...patch };
      if (next.approved && !isValid(next)) next.approved = false; // editing a field empty un-approves it
      return next;
    }));

  function addBlank() {
    setDrafts((ds) => [...ds, { topic: manSubject, level: 1, q: "", choices: ["", "", "", ""], answer: 0, explain: "", approved: false, src: "manual" }]);
    setTimeout(() => {
      const areas = listRef.current?.querySelectorAll<HTMLTextAreaElement>("textarea[data-q]");
      areas?.[areas.length - 1]?.focus();
    }, 0);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(null);
    if (!f) return;
    if (!/\.(pdf|docx|txt|md)$/i.test(f.name)) { setFileInfo("รองรับ .pdf .docx .txt .md เท่านั้น (ไฟล์ .doc/.ppt แบบเก่าให้บันทึกเป็น PDF ก่อน)"); return; }
    if (f.size > 4 * 1024 * 1024) { setFileInfo("ไฟล์ใหญ่เกิน 4 MB ลองแยกเป็นไฟล์ย่อย หรือคัดลอกเฉพาะเนื้อหาที่ต้องการมาวาง"); return; }
    setFile(f);
    setFileInfo(`เลือกไฟล์ ${f.name} (${(f.size / 1024).toFixed(0)} KB) แล้ว`);
  }

  async function runAI() {
    const content = src === "topic" ? topic.trim() : src === "text" ? text.trim().slice(0, 12000) : "";
    if (src === "file" ? !file : content.length < 3) { toast(src === "file" ? "กรุณาเลือกไฟล์ก่อน" : "กรุณาใส่หัวข้อหรือเนื้อหาก่อน"); return; }
    setBusy(true);
    try {
      const qs = await generateQuestions({ subject, count, level, mode: src, content, file });
      setDrafts((ds) => [...ds, ...qs.map((q) => ({ ...q, topic: subject, approved: false, src: "ai" as const }))]);
      toast(`AI ร่างข้อสอบ ${qs.length} ข้อแล้ว กรุณาตรวจและอนุมัติทีละข้อ`);
      setTimeout(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      toast(e instanceof Error ? e.message : "สร้างข้อสอบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    const ok = drafts.filter((d) => d.approved && isValid(d));
    setPublishErr("");
    if (ok.length < 3) { setPublishErr(`ต้องมีคำถามที่อนุมัติแล้วอย่างน้อย 3 ข้อ (ตอนนี้ ${ok.length} ข้อ) ข้อที่ยังไม่ได้ตรวจจะไม่ถูกเผยแพร่`); return; }
    setPublishing(true);
    try {
      const r = await fetch("/api/quizzes", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, questions: ok.map(({ topic, level, q, choices, answer, explain }) => ({ topic, level, q, choices, answer, explain })) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setPublishErr(d.error || "เผยแพร่ไม่สำเร็จ"); return; }
      const pending = drafts.length - ok.length;
      setDrafts((ds) => ds.filter((x) => !(x.approved && isValid(x))));
      setPublishedPin(d.pin);
      toast(`เผยแพร่ ${d.count} ข้อแล้ว` + (pending ? ` (ข้อที่ยังไม่อนุมัติ ${pending} ข้อยังอยู่ในร่าง)` : ""));
    } catch {
      setPublishErr("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setPublishing(false);
    }
  }

  const approved = drafts.filter((d) => d.approved).length;

  return (
    <section className="view">
      <div className="studio">
        <aside className="side" aria-label="เมนูผู้สอน">
          <div className="s-item">แดชบอร์ด</div>
          <div className="s-item on">สร้าง Quiz</div>
          <div className="s-item">คลังข้อสอบ</div>
          <div className="s-item">รายงานผล</div>
          <div className="s-item">ห้องเรียน</div>
          <p className="s-note">ตอนนี้เปิดใช้เฉพาะเมนู &quot;สร้าง Quiz&quot; ส่วนเมนูอื่นจะมาในระยะที่ 5</p>
        </aside>

        <div className="view" style={{ gap: 18 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div><h2 style={{ fontSize: 26 }}>สร้างแบบทดสอบ</h2><p className="muted small">ร่างคำถาม ตรวจแก้ อนุมัติ แล้วเผยแพร่เป็นห้องเกม</p></div>
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={tab === "manual"} className={tab === "manual" ? "on" : ""} onClick={() => setTab("manual")}>สร้างเอง</button>
              <button role="tab" aria-selected={tab === "ai"} className={tab === "ai" ? "on" : ""} onClick={() => setTab("ai")}>AI สร้างจากเนื้อหา</button>
            </div>
          </div>

          {tab === "ai" ? (
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <h3 style={{ fontSize: 18 }}>AI สร้างข้อสอบให้อัตโนมัติ</h3>
                <p className="muted small">เลือกแหล่งเนื้อหา AI จะร่างคำถาม ตัวเลือก เฉลย และคำอธิบาย คุณต้องตรวจและกดอนุมัติทุกข้อก่อนเผยแพร่</p>
              </div>
              <div className="grid src3">
                {([["file", "อัปโหลดไฟล์", "PDF / DOCX / TXT"], ["topic", "ใส่หัวข้อ", "เช่น ระบบสุริยะ"], ["text", "วางข้อความ", "จากบทเรียนหรือชีต"]] as const).map(([k, t, d]) => (
                  <button type="button" key={k} className={"src" + (src === k ? " on" : "")} onClick={() => setSrc(k)}>
                    <b>{t}</b><span className="small muted">{d}</span>
                  </button>
                ))}
              </div>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
                <label className="fld">วิชา
                  <select id="aiSubject" value={subject} onChange={(e) => setSubject(e.target.value)}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select>
                </label>
                <label className="fld">จำนวนข้อ
                  <select id="aiCount" value={count} onChange={(e) => setCount(+e.target.value)}>{[3, 5, 8].map((n) => <option key={n} value={n}>{n}</option>)}</select>
                </label>
                <label className="fld">ระดับความยาก
                  <select id="aiLevel" value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
                    <option value="mix">คละระดับ (สำหรับ Adaptive)</option><option value="1">ง่าย</option><option value="2">ปานกลาง</option><option value="3">ยาก</option>
                  </select>
                </label>
              </div>
              {src === "topic" && <label className="fld">หัวข้อ<input type="text" id="aiTopic" value={topic} onChange={(e) => setTopic(e.target.value)} /></label>}
              {src === "text" && <label className="fld">เนื้อหาบทเรียน<textarea id="aiText" value={text} onChange={(e) => setText(e.target.value)} placeholder="วางเนื้อหาบทเรียนที่นี่ (สูงสุดประมาณ 12,000 ตัวอักษร)" /></label>}
              {src === "file" && (
                <div>
                  <label className="fld">ไฟล์เนื้อหา<input type="file" id="aiFile" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" onChange={onFile} /></label>
                  <p className="small muted" style={{ marginTop: 6 }}>{fileInfo}</p>
                </div>
              )}
              <div className="row">
                <button className="btn btn-primary" onClick={runAI} disabled={!aiReady || busy}>{busy ? "AI กำลังร่างข้อสอบ… (10-60 วินาที)" : "สร้างด้วย AI"}</button>
                <span className={"ai-status" + (aiReady ? " ok" : "")}>
                  {aiReady === null ? "กำลังตรวจสถานะ AI…" : aiReady ? "AI (Gemini) พร้อมใช้งาน" : AI_OFF_NOTE}
                </span>
              </div>
            </div>
          ) : (
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <h3 style={{ fontSize: 18 }}>สร้างคำถามเอง</h3>
              <p className="muted small">เพิ่มคำถามเปล่า กรอกคำถาม ตัวเลือก 4 ข้อ เลือกเฉลย แล้วเขียนคำอธิบายสั้นๆ ที่จะแสดงหลังผู้เรียนตอบ</p>
              <div className="row">
                <label className="fld" style={{ flex: "1 1 200px" }}>วิชา
                  <select id="manSubject" value={manSubject} onChange={(e) => setManSubject(e.target.value)}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select>
                </label>
                <button className="btn btn-primary" style={{ alignSelf: "end" }} onClick={addBlank}>+ เพิ่มคำถาม</button>
              </div>
            </div>
          )}

          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ fontSize: 18 }}>ร่างคำถาม <span className="pill num">{drafts.length} ข้อ</span></h3>
            {drafts.length > 0 && <span className="small muted">อนุมัติแล้ว {approved} จาก {drafts.length} ข้อ</span>}
          </div>

          <div className="grid" style={{ gap: 12 }} ref={listRef}>
            {drafts.length === 0 && (
              <div className="card" style={{ boxShadow: "none" }}>
                <p className="muted">ยังไม่มีร่างคำถาม ให้ AI สร้างจากหัวข้อด้านบน หรือเปิดแท็บ &quot;สร้างเอง&quot; เพื่อเพิ่มทีละข้อ</p>
              </div>
            )}
            {drafts.map((d, i) => (
              <div className={"draft" + (d.approved ? " approved" : "")} key={i}>
                <div className="draft-head">
                  <div className="row" style={{ gap: 8 }}>
                    <b style={{ fontFamily: "var(--f-display)" }}>ข้อ {i + 1}</b>
                    <span className="pill">{d.topic}</span>
                    {d.src === "ai" && <span className="pill warn">ร่างโดย AI</span>}
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <select aria-label="ระดับความยาก" style={{ width: "auto", padding: "6px 10px" }} value={d.level} onChange={(e) => update(i, { level: +e.target.value })}>
                      {[1, 2, 3].map((l) => <option key={l} value={l}>{LEVEL[l]}</option>)}
                    </select>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDrafts((ds) => ds.filter((_, j) => j !== i))}>ลบ</button>
                  </div>
                </div>
                <textarea data-q rows={2} placeholder="พิมพ์คำถาม" style={{ minHeight: 56 }} aria-label="คำถาม" value={d.q} onChange={(e) => update(i, { q: e.target.value })} />
                <div className="choice-edit">
                  {d.choices.map((c, j) => (
                    <label key={j} className={d.answer === j ? "correct" : ""}>
                      <input type="radio" name={`ans${i}`} checked={d.answer === j} onChange={() => update(i, { answer: j })} aria-label="ตั้งเป็นคำตอบที่ถูก" />
                      <input type="text" value={c} placeholder={`ตัวเลือก ${KEYS[j]}`}
                        onChange={(e) => update(i, { choices: d.choices.map((x, k) => (k === j ? e.target.value : x)) })} />
                    </label>
                  ))}
                </div>
                <textarea rows={2} placeholder="คำอธิบายเฉลย (แสดงหลังผู้เรียนตอบ)" style={{ minHeight: 56 }} aria-label="คำอธิบาย" value={d.explain} onChange={(e) => update(i, { explain: e.target.value })} />
                <label className="approve">
                  <input type="checkbox" checked={d.approved} onChange={(e) => {
                    if (e.target.checked && !isValid(d)) { toast("กรอกคำถามและตัวเลือกให้ครบ 4 ข้อก่อนอนุมัติ"); return; }
                    update(i, { approved: e.target.checked });
                  }} /> ตรวจแล้ว อนุมัติให้ใช้ข้อนี้
                </label>
              </div>
            ))}
          </div>

          <div className="card publish-bar">
            <label className="fld" style={{ flex: "1 1 260px" }}>ชื่อชุดข้อสอบ<input type="text" id="quizTitle" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            <button className="btn btn-primary" onClick={publish} disabled={publishing || me?.role !== "teacher"}>{publishing ? "กำลังเผยแพร่…" : "เผยแพร่และสร้าง PIN"}</button>
            {me?.role !== "teacher" && (
              <p className="small muted" style={{ flexBasis: "100%" }}>
                ร่างคำถามได้ทุกคน แต่การเผยแพร่เป็นห้องเกมต้อง <Link href="/login">เข้าสู่ระบบด้วยบัญชีครู</Link>
              </p>
            )}
            <p className="err" style={{ flexBasis: "100%" }}>{publishErr}</p>
            {publishedPin && (
              <div style={{ flexBasis: "100%", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <div><p className="small muted">PIN ห้องเกม</p><p className="pin-big num">{publishedPin}</p></div>
                <Link className="btn btn-soft" href="/join">ไปหน้าเข้าร่วมเกม (เปิดห้องสดได้ที่นั่น)</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
