import "server-only";
import { SUBJECTS } from "../constants";
import { QUEST_SIZE, STAGE_LEVEL, STAGE_NAME } from "../quest";
import { supabaseAdmin } from "../supabase/server";
import type { Question } from "../types";
import { aiConfigured, callGemini, MODEL_FAST, MODEL_MAIN, parseJson } from "./gemini";
import { HttpError } from "./http";
import { cleanQuestion, QUESTION_SCHEMA } from "./questions";

/**
 * Stage questions come from a shared bank (quest_questions). When a stage has
 * too few, Gemini writes a batch once and it is saved for everyone after.
 */
const BANK_TARGET = 10;
const LEVEL_TEXT: Record<number, string> = {
  1: "ง่าย: ความรู้พื้นฐาน จำและเข้าใจ",
  2: "ง่าย-ปานกลาง: ฝึกใช้ความรู้พื้นฐาน",
  3: "ปานกลาง: ประยุกต์ใช้กับสถานการณ์",
  4: "ปานกลาง-ยาก: วิเคราะห์หลายขั้นตอน",
  5: "ยาก: โจทย์ท้าทายระดับสอบแข่งขัน ม.ปลาย",
};

async function fromBank(subject: string, stage: number) {
  const { data, error } = await supabaseAdmin().from("quest_questions").select("id, q, choices, answer, explain").eq("subject", subject).eq("stage", stage).limit(60);
  if (error) throw new HttpError(503, error.code === "42P01" ? "ยังไม่ได้รัน supabase/quest-team.sql" : "โหลดคลังภารกิจไม่สำเร็จ");
  return data ?? [];
}

async function fillBank(subject: string, stage: number, need: number) {
  const prompt = `คุณเป็นครูออกข้อสอบวิชา${subject} สำหรับนักเรียนมัธยม ในเกมภารกิจ "ด่าน ${stage}: ${STAGE_NAME[stage]}"
สร้างข้อสอบปรนัย 4 ตัวเลือก จำนวน ${need} ข้อ ระดับ${LEVEL_TEXT[stage]}
- ใช้ภาษาไทย (วิชาภาษาอังกฤษใช้ภาษาอังกฤษในโจทย์ได้) ครอบคลุมหลายเรื่องในหลักสูตร ไม่ซ้ำแนวกัน
- คำตอบถูกข้อเดียว ตัวลวงสมเหตุสมผล ไม่มี "ถูกทุกข้อ"
- คำอธิบายบอกเหตุผลสั้นๆ ไม่เกิน 2 ประโยค ตรวจให้โจทย์และคำอธิบายสอดคล้องกัน
ตอบเป็น JSON ตาม schema`;
  const raw = await callGemini({
    model: MODEL_MAIN, fallback: MODEL_FAST, temperature: 0.5, maxOutputTokens: 6000,
    parts: [{ text: prompt }],
    schema: { type: "object", properties: { questions: { type: "array", items: QUESTION_SCHEMA } }, required: ["questions"] },
  });
  const thai = /[฀-๿]/;
  const rows = (parseJson<{ questions?: unknown[] }>(raw).questions ?? [])
    .map((x) => cleanQuestion(x, subject))
    .filter((q): q is Question => !!q && (subject === "ภาษาอังกฤษ" || thai.test(q.q + q.explain)))
    .map((q) => ({ subject, stage, q: q.q, choices: q.choices, answer: q.answer, explain: q.explain }));
  if (rows.length) await supabaseAdmin().from("quest_questions").insert(rows);
}

/** Five random questions for a stage (with answer keys: quests are personal practice, graded in the browser). */
export async function stageQuestions(subject: string, stage: number): Promise<Question[]> {
  if (!SUBJECTS.includes(subject)) throw new HttpError(400, "วิชาไม่ถูกต้อง");
  if (!Number.isInteger(stage) || stage < 1 || stage > 5) throw new HttpError(400, "ด่านไม่ถูกต้อง");

  let bank = await fromBank(subject, stage);
  if (bank.length < QUEST_SIZE || (bank.length < BANK_TARGET && aiConfigured())) {
    if (!aiConfigured() && bank.length < QUEST_SIZE) throw new HttpError(503, "ด่านนี้ยังไม่มีคำถาม และยังไม่ได้ตั้งค่า AI");
    try { await fillBank(subject, stage, BANK_TARGET - bank.length + 2); } catch (e) { if (bank.length < QUEST_SIZE) throw e; }
    bank = await fromBank(subject, stage);
  }
  if (bank.length < QUEST_SIZE) throw new HttpError(503, "เตรียมคำถามด่านนี้ไม่สำเร็จ ลองใหม่อีกครั้ง");

  return bank
    .map((r) => ({ r, k: Math.random() }))
    .sort((a, b) => a.k - b.k)
    .slice(0, QUEST_SIZE)
    .map(({ r }) => ({ id: r.id, qid: "quest:" + r.id, topic: subject, level: STAGE_LEVEL[stage], q: r.q, choices: r.choices, answer: r.answer, explain: r.explain }));
}
