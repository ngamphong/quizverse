"use client";
/**
 * Every AI feature in the browser goes through this file.
 * It calls our own API routes (/api/ai/*); those call Gemini on the server,
 * so GEMINI_API_KEY never reaches the browser.
 */
import { useEffect, useState } from "react";
import type { Question } from "./types";

export const AI_OFF_NOTE = "AI ยังไม่พร้อม: ผู้ดูแลต้องตั้งค่า GEMINI_API_KEY ก่อน ตอนนี้สร้างคำถามเองได้ในแท็บ \"สร้างเอง\"";

let statusPromise: Promise<boolean> | null = null;
function fetchStatus() {
  statusPromise ??= fetch("/api/ai/status")
    .then((r) => (r.ok ? r.json() : { ready: false }))
    .then((d) => !!d.ready)
    .catch(() => false);
  return statusPromise;
}

/** null while checking, then true/false. */
export function useAiReady(): boolean | null {
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => { let live = true; fetchStatus().then((r) => live && setReady(r)); return () => { live = false; }; }, []);
  return ready;
}

async function post<T>(path: string, body: BodyInit, json = true): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { method: "POST", body, ...(json ? { headers: { "content-type": "application/json" } } : {}) });
  } catch {
    throw new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
  return data as T;
}

export interface GenerateRequest {
  subject: string;
  count: number;
  level: "mix" | "1" | "2" | "3";
  mode: "topic" | "text" | "file";
  content: string;
  file?: File | null;
}

export async function generateQuestions(req: GenerateRequest): Promise<Question[]> {
  const fd = new FormData();
  fd.set("subject", req.subject);
  fd.set("count", String(req.count));
  fd.set("level", req.level);
  fd.set("mode", req.mode);
  fd.set("content", req.content);
  if (req.mode === "file" && req.file) fd.set("file", req.file);
  const { questions } = await post<{ questions: Question[] }>("/api/ai/generate", fd, false);
  return questions;
}

export async function explainMistake(question: Question, choice: number) {
  const { topic, level, q, choices, answer, explain } = question;
  return post<{ explanation: string; practice: Question | null }>(
    "/api/ai/explain",
    JSON.stringify({ question: { topic, level, q, choices, answer, explain }, choice }),
  );
}

export async function studyCoach(summary: string): Promise<string> {
  const { plan } = await post<{ plan: string }>("/api/ai/coach", JSON.stringify({ summary }));
  return plan;
}
