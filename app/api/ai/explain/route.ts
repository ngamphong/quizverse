import { NextResponse } from "next/server";
import { KEYS } from "@/lib/constants";
import { AiError, callGemini, MODEL_FAST, parseJson } from "@/lib/server/gemini";
import { cleanQuestion, QUESTION_SCHEMA } from "@/lib/server/questions";
import { rateLimited } from "@/lib/server/rateLimit";
import { fail, tooMany } from "../_shared";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * AI Mistake Explainer: explains why the chosen answer is wrong (anchored to the
 * teacher-approved key) and creates one new practice question on the same idea.
 * Body (JSON): { question: Question, choice: number }  (choice -1 = ran out of time)
 */
export async function POST(req: Request) {
  if (rateLimited(req)) return tooMany();
  try {
    const body = await req.json().catch(() => null);
    const q = cleanQuestion(body?.question, String(body?.question?.topic ?? "").slice(0, 40));
    const choice = Number(body?.choice);
    if (!q || !Number.isInteger(choice) || choice < -1 || choice > 3) throw new AiError(400, "ข้อมูลคำถามไม่ถูกต้อง");
    const picked = choice < 0 ? "ไม่ได้ตอบ (หมดเวลา)" : `${KEYS[choice]}. ${q.choices[choice]}`;

    const prompt = `นักเรียนมัธยมตอบคำถามวิชา${q.topic}ผิด ช่วยทำ 2 อย่าง:
1) "explanation": อธิบายเป็นภาษาไทยที่เป็นกันเอง ไม่เกิน 110 คำ แบ่ง 3 ส่วนสั้นๆ ขึ้นบรรทัดใหม่แต่ละส่วน
   - ทำไมคำตอบที่เลือกจึงไม่ถูก
   - หลักการหรือวิธีคิดที่ถูกต้อง
   - เทคนิคจำหรือตัวอย่างสั้นๆ 1 ข้อ
   ไม่ต้องใช้ Markdown และห้ามขัดแย้งกับเฉลยที่ครูตรวจแล้ว
2) "practice": สร้างโจทย์ใหม่ 1 ข้อ แนวคิดเดียวกันแต่ตัวเลขหรือสถานการณ์ต่างไป ระดับเท่ากันหรือง่ายกว่าเล็กน้อย เพื่อให้นักเรียนฝึกแก้จุดอ่อน

คำถาม: ${q.q}
ตัวเลือก: ${q.choices.map((c, i) => `${KEYS[i]}. ${c}`).join(" | ")}
นักเรียนตอบ: ${picked}
เฉลยที่ครูตรวจแล้ว: ${KEYS[q.answer]}. ${q.choices[q.answer]}
คำอธิบายของครู: ${q.explain || "-"}`;

    const raw = await callGemini({
      model: MODEL_FAST,
      parts: [{ text: prompt }],
      schema: { type: "object", properties: { explanation: { type: "string" }, practice: QUESTION_SCHEMA }, required: ["explanation", "practice"] },
      maxOutputTokens: 2048,
      temperature: 0.5,
    });
    const data = parseJson<{ explanation?: string; practice?: unknown }>(raw);
    const explanation = String(data.explanation ?? "").trim();
    if (!explanation) throw new AiError(502, "AI ไม่ได้ส่งคำอธิบายกลับมา ลองใหม่อีกครั้ง");
    const practice = cleanQuestion(data.practice, q.topic);
    return NextResponse.json({ explanation, practice });
  } catch (e) {
    return fail(e);
  }
}
