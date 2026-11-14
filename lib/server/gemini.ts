import "server-only";

/**
 * Thin wrapper around the Gemini REST API (generateContent).
 * Runs only on the server: GEMINI_API_KEY never reaches the browser.
 * Model names come from env so they can be changed in Vercel without a code change.
 */
const API = "https://generativelanguage.googleapis.com/v1beta/models";

export const MODEL_MAIN = process.env.GEMINI_MODEL || "gemini-3.8-flash"; // quiz generation
export const MODEL_FAST = process.env.GEMINI_MODEL_FAST || "gemini-3.5-flash-lite"; // explanations, coach

export const aiConfigured = () => !!process.env.GEMINI_API_KEY;

export class AiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

interface CallOptions {
  model: string;
  parts: Part[];
  /** JSON Schema — when given, Gemini must answer with JSON matching it */
  schema?: object;
  maxOutputTokens?: number;
  temperature?: number;
}

export async function callGemini({ model, parts, schema, maxOutputTokens = 4096, temperature = 0.7 }: CallOptions): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AiError(503, "ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์");

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature,
      maxOutputTokens,
      ...(schema ? { responseMimeType: "application/json", responseJsonSchema: schema } : {}),
    },
  };

  let res: Response;
  try {
    res = await fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55_000),
    });
  } catch {
    throw new AiError(504, "เชื่อมต่อ Gemini ไม่ได้หรือใช้เวลานานเกินไป ลองใหม่อีกครั้ง");
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[gemini] ${res.status} ${model}: ${detail.slice(0, 500)}`);
    if (res.status === 429) throw new AiError(429, "ใช้ AI ถึงโควตาของ Gemini แล้ว รอสักครู่แล้วลองใหม่");
    if (/API_KEY_INVALID|API key not valid|API key expired/i.test(detail)) throw new AiError(502, "GEMINI_API_KEY ไม่ถูกต้องหรือหมดอายุ ตรวจ key ใน .env.local หรือใน Vercel");
    if (res.status === 400 || res.status === 404) throw new AiError(502, `Gemini ไม่รับคำขอ (ตรวจชื่อโมเดล "${model}" และ API key)`);
    if (res.status === 401 || res.status === 403) throw new AiError(502, "GEMINI_API_KEY ไม่ถูกต้องหรือไม่มีสิทธิ์");
    throw new AiError(502, "Gemini ขัดข้องชั่วคราว ลองใหม่อีกครั้ง");
  }

  const data = await res.json();
  if (data?.promptFeedback?.blockReason) throw new AiError(422, "Gemini ปฏิเสธเนื้อหานี้ ลองปรับเนื้อหาแล้วสร้างใหม่");
  const cand = data?.candidates?.[0];
  const text: string = (cand?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  if (!text.trim()) {
    if (cand?.finishReason === "SAFETY") throw new AiError(422, "Gemini ปฏิเสธเนื้อหานี้ ลองปรับเนื้อหาแล้วสร้างใหม่");
    throw new AiError(502, "Gemini ไม่ได้ตอบกลับ ลองใหม่อีกครั้ง");
  }
  return text;
}

/** Parses JSON from a model reply, tolerating a ```json fence around it. */
export function parseJson<T>(text: string): T {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(t) as T;
  } catch {
    throw new AiError(502, "AI ตอบกลับในรูปแบบที่อ่านไม่ได้ ลองกดสร้างอีกครั้ง");
  }
}
