import { NextResponse } from "next/server";
import { AiError, callGemini, MODEL_FAST } from "@/lib/server/gemini";
import { rateLimited } from "@/lib/server/rateLimit";
import { fail, tooMany } from "../_shared";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * AI Study Coach: a 7-day plan from the learner's per-subject results.
 * Body (JSON): { summary: string } — subject scores and revision items only, no names.
 */
export async function POST(req: Request) {
  if (rateLimited(req)) return tooMany();
  try {
    const body = await req.json().catch(() => null);
    const summary = String(body?.summary ?? "").trim().slice(0, 3000);
    if (!summary) throw new AiError(400, "ไม่มีข้อมูลผลการเรียน");

    const prompt = `คุณคือ AI Study Coach ของแอป QUIZVERSE เขียนแผนการเรียน 7 วันสำหรับนักเรียนมัธยม เป็นภาษาไทย ไม่เกิน 160 คำ ไม่ใช้ Markdown
เริ่มด้วยประโยคชมจุดแข็ง 1 ประโยค ตามด้วยแผนรายวันสั้นๆ (วันละ 15-20 นาที) เน้นวิชาที่อ่อนที่สุดก่อน และปิดด้วยกำลังใจ 1 ประโยค

ผลการเรียน:
${summary}`;

    const plan = await callGemini({ model: MODEL_FAST, parts: [{ text: prompt }], maxOutputTokens: 1024 });
    return NextResponse.json({ plan: plan.trim() });
  } catch (e) {
    return fail(e);
  }
}
