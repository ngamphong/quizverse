import "server-only";
import { NextResponse } from "next/server";

/** An error with an HTTP status and a Thai message that is safe to show to users. */
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function fail(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error("[api] unexpected", e);
  return NextResponse.json({ error: "เกิดข้อผิดพลาดในเซิร์ฟเวอร์ ลองใหม่อีกครั้ง" }, { status: 500 });
}

export const tooMany = () =>
  NextResponse.json({ error: "เรียกใช้ถี่เกินไป รอประมาณ 10 นาทีแล้วลองใหม่" }, { status: 429 });
