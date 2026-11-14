"use client";
import { useState } from "react";
import { KEYS, LEVEL } from "@/lib/constants";
import type { Question } from "@/lib/types";

export const isQuestionValid = (q: Pick<Question, "q" | "choices">) =>
  q.q.trim() !== "" && q.choices.every((c) => c.trim() !== "") && new Set(q.choices.map((c) => c.trim())).size === 4;

interface Props {
  index: number;
  value: Question;
  onChange: (patch: Partial<Question>) => void;
  onRemove: () => void;
  badge?: React.ReactNode;
  /** teachers can attach a picture (uploaded to our storage) */
  canUpload?: boolean;
  /** studio drafts: approval checkbox */
  approved?: boolean;
  onApprove?: (v: boolean) => void;
}

/** Editable question: text, 4 choices with the correct one, explanation, level, optional picture. */
export default function QuestionCard({ index, value: d, onChange, onRemove, badge, canUpload, approved, onApprove }: Props) {
  const [uploading, setUploading] = useState(false);
  const [imgErr, setImgErr] = useState("");

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return setImgErr("รูปใหญ่เกิน 2 MB ลองย่อรูปก่อน");
    setUploading(true); setImgErr("");
    try {
      const fd = new FormData();
      fd.set("file", f);
      const r = await fetch("/api/teacher/upload", { method: "POST", body: fd });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return setImgErr(data.error || "อัปโหลดรูปไม่สำเร็จ");
      onChange({ image: data.url });
    } catch {
      setImgErr("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={"draft" + (approved ? " approved" : "")}>
      <div className="draft-head">
        <div className="row" style={{ gap: 8 }}>
          <b style={{ fontFamily: "var(--f-display)" }}>ข้อ {index + 1}</b>
          <span className="pill">{d.topic}</span>
          {badge}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <select aria-label="ระดับความยาก" style={{ width: "auto", padding: "6px 10px" }} value={d.level} onChange={(e) => onChange({ level: +e.target.value })}>
            {[1, 2, 3].map((l) => <option key={l} value={l}>{LEVEL[l]}</option>)}
          </select>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove}>ลบ</button>
        </div>
      </div>
      <textarea data-q rows={2} placeholder="พิมพ์คำถาม" style={{ minHeight: 56 }} aria-label="คำถาม" value={d.q} onChange={(e) => onChange({ q: e.target.value })} />
      {(d.image || canUpload) && (
        <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {d.image && <img src={d.image} alt="รูปประกอบคำถาม" style={{ maxHeight: 120, maxWidth: "100%", borderRadius: 10, border: "1px solid var(--line)" }} />}
          {canUpload && (
            <div className="row" style={{ gap: 8 }}>
              <label className="btn btn-soft btn-sm" style={{ cursor: uploading ? "wait" : "pointer" }}>
                {uploading ? "กำลังอัปโหลด…" : d.image ? "เปลี่ยนรูป" : "+ เพิ่มรูปประกอบ"}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden disabled={uploading} onChange={upload} />
              </label>
              {d.image && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ image: null })}>เอารูปออก</button>}
            </div>
          )}
          {imgErr && <span className="err">{imgErr}</span>}
        </div>
      )}
      <div className="choice-edit">
        {d.choices.map((c, j) => (
          <label key={j} className={d.answer === j ? "correct" : ""}>
            <input type="radio" name={`ans${index}`} checked={d.answer === j} onChange={() => onChange({ answer: j })} aria-label="ตั้งเป็นคำตอบที่ถูก" />
            <input type="text" value={c} placeholder={`ตัวเลือก ${KEYS[j]}`}
              onChange={(e) => onChange({ choices: d.choices.map((x, k) => (k === j ? e.target.value : x)) })} />
          </label>
        ))}
      </div>
      <textarea rows={2} placeholder="คำอธิบายเฉลย (แสดงหลังผู้เรียนตอบ)" style={{ minHeight: 56 }} aria-label="คำอธิบาย" value={d.explain} onChange={(e) => onChange({ explain: e.target.value })} />
      {onApprove && (
        <label className="approve">
          <input type="checkbox" checked={!!approved} onChange={(e) => onApprove(e.target.checked)} /> ตรวจแล้ว อนุมัติให้ใช้ข้อนี้
        </label>
      )}
    </div>
  );
}
