"use client";
import { useEffect, useState } from "react";
import { SUBJECTS } from "@/lib/constants";
import { normalizeSubject } from "@/lib/subjects";

const KEY = "qv_subjects";
const ADD = "__add__";
const loadCustom = (): string[] => { try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; } };
const saveCustom = (list: string[]) => { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 30))); } catch { /* ignore */ } };

/** Subject dropdown with the 5 core subjects, the teacher's own subjects, and "+ เพิ่มวิชาใหม่". */
export default function SubjectPicker({ id, value, onChange, extra = [] }: { id: string; value: string; onChange: (s: string) => void; extra?: string[] }) {
  const [custom, setCustom] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => setCustom(loadCustom()), []);
  const options = [...new Set([...SUBJECTS, ...custom, ...extra, value].filter(Boolean))];

  function add() {
    const s = normalizeSubject(draft);
    if (!s) return;
    const next = custom.includes(s) || SUBJECTS.includes(s) ? custom : [...custom, s];
    setCustom(next); saveCustom(next);
    onChange(s); setAdding(false); setDraft("");
  }

  if (adding)
    return (
      <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
        <input type="text" id={id} autoFocus maxLength={40} placeholder="ชื่อวิชาใหม่ เช่น ฟิสิกส์" value={draft}
          onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } if (e.key === "Escape") setAdding(false); }} />
        <button type="button" className="btn btn-primary btn-sm" onClick={add} disabled={!normalizeSubject(draft)}>เพิ่ม</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>ยกเลิก</button>
      </div>
    );

  return (
    <select id={id} value={value} onChange={(e) => (e.target.value === ADD ? setAdding(true) : onChange(e.target.value))}>
      {options.map((s) => <option key={s} value={s}>{s}</option>)}
      <option value={ADD}>+ เพิ่มวิชาใหม่…</option>
    </select>
  );
}
