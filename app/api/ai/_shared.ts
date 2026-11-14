import "server-only";
import { NextResponse } from "next/server";
import { AiError } from "@/lib/server/gemini";

export function fail(e: unknown) {
  if (e instanceof AiError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error("[ai] unexpected", e);
  return NextResponse.json({ error: "เกิดข้อผิดพลาดในเซิร์ฟเวอร์ ลองใหม่อีกครั้ง" }, { status: 500 });
}

export const tooMany = () =>
  NextResponse.json({ error: "เรียกใช้ AI ถี่เกินไป รอประมาณ 10 นาทีแล้วลองใหม่" }, { status: 429 });
