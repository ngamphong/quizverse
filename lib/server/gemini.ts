import "server-only";
import { HttpError } from "./http";

/**
 * Thin wrapper around the Gemini REST API (generateContent).
 * Runs only on the server: GEMINI_API_KEY never reaches the browser.
 * Model names come from env so they can be changed in Vercel without a code change.
 */
const API = "https://generativelanguage.googleapis.com/v1beta/models";

// gemini-3.8-flash took >25 s per quiz on the free key (it thinks before answering), so the
// fast model is the default for everything; set GEMINI_MODEL to try a bigger model.
export const MODEL_MAIN = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite"; // quiz generation
export const MODEL_FAST = process.env.GEMINI_MODEL_FAST || "gemini-3.5-flash-lite"; // explanations, coach

export const aiConfigured = () => !!process.env.GEMINI_API_KEY;

export class AiError extends HttpError {}

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

interface CallOptions {
  model: string;
  parts: Part[];
  /** JSON Schema — when given, Gemini must answer with JSON matching it */
  schema?: object;
  maxOutputTokens?: number;
  temperature?: number;
  /** model to retry once with if `model` is overloaded, out of quota or unavailable */
  fallback?: string;
}

/** Google answered quickly but could not serve this model right now — worth one retry on another model. */
class RetryableError extends AiError {}

export async function callGemini(opts: CallOptions): Promise<string> {
  const hasFallback = !!opts.fallback && opts.fallback !== opts.model;
  try {
    // with a fallback, give the main model 25 s so the retry still fits in Vercel's 60 s limit
    return await attempt(opts.model, opts, hasFallback ? 25_000 : 50_000);
  } catch (e) {
    if (!(e instanceof RetryableError) || !hasFallback) throw e;
    console.warn(`[gemini] ${opts.model} failed (${e.message}), retrying with ${opts.fallback}`);
    return attempt(opts.fallback!, opts, 30_000);
  }
}

async function attempt(model: string, { parts, schema, maxOutputTokens = 4096, temperature = 0.7 }: CallOptions, timeoutMs: number): Promise<string> {
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
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new RetryableError(504, `เชื่อมต่อ Gemini ไม่ได้หรือใช้เวลานานเกินไป ลองใหม่อีกครั้ง (${model})`);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[gemini] ${res.status} ${model}: ${detail.slice(0, 500)}`);
    const code = ` (Gemini ${res.status}, ${model})`;
    if (/API_KEY_INVALID|API key not valid|API key expired/i.test(detail)) throw new AiError(502, "GEMINI_API_KEY ไม่ถูกต้องหรือหมดอายุ ตรวจ key ใน .env.local หรือใน Vercel");
    if (res.status === 429) throw new RetryableError(429, "ใช้ AI ถึงโควตาของ Gemini แล้ว รอสักครู่แล้วลองใหม่" + code);
    if (res.status === 404) throw new RetryableError(502, `ไม่พบโมเดล "${model}" ตั้ง GEMINI_MODEL ใหม่ใน Vercel` + code);
    if (res.status === 400) throw new AiError(502, "Gemini ไม่รับคำขอนี้" + code);
    if (res.status === 401 || res.status === 403) throw new RetryableError(502, "API key นี้ใช้โมเดลนี้ไม่ได้ (อาจต้องเปิด billing)" + code);
    throw new RetryableError(502, "Gemini ขัดข้องชั่วคราว ลองใหม่อีกครั้ง" + code);
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
