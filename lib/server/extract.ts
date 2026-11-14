import "server-only";
import { AiError } from "./gemini";

/** Vercel caps request bodies at about 4.5 MB, so stay under it. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_TEXT_CHARS = 12_000;

export type Source =
  | { kind: "text"; text: string }
  | { kind: "pdf"; base64: string };

/**
 * Turns an uploaded lesson file into something Gemini can read:
 * PDF → sent as-is (Gemini reads PDFs natively), DOCX → plain text via mammoth, TXT/MD → text.
 */
export async function readUpload(file: File): Promise<Source> {
  if (file.size > MAX_FILE_BYTES) throw new AiError(413, "ไฟล์ใหญ่เกิน 4 MB ลองแยกเป็นไฟล์ย่อย หรือคัดลอกเฉพาะเนื้อหาที่ต้องการมาวาง");
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return { kind: "pdf", base64: buf.toString("base64") };
  }
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return text(value);
  }
  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return text(buf.toString("utf8"));
  }
  throw new AiError(415, "รองรับไฟล์ .pdf .docx .txt และ .md (ไฟล์ .doc และ .ppt แบบเก่าให้บันทึกเป็น PDF ก่อน)");
}

function text(raw: string): Source {
  const t = raw.replace(/\s+\n/g, "\n").trim();
  if (t.length < 20) throw new AiError(422, "อ่านข้อความจากไฟล์ได้น้อยเกินไป ลองใช้ไฟล์อื่นหรือวางข้อความแทน");
  return { kind: "text", text: t.slice(0, MAX_TEXT_CHARS) };
}
