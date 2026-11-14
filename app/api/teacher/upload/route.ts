import { NextResponse } from "next/server";
import { fail, HttpError, tooMany } from "@/lib/server/http";
import { rateLimited } from "@/lib/server/rateLimit";
import { requireTeacher, uploadImage } from "@/lib/server/teacher";

export const runtime = "nodejs";

/** multipart: file → { url } in the public question-images bucket. Teachers only. */
export async function POST(req: Request) {
  if (rateLimited(req, "upload", 60)) return tooMany();
  try {
    const uid = await requireTeacher();
    const file = (await req.formData()).get("file");
    if (!(file instanceof File) || !file.size) throw new HttpError(400, "กรุณาเลือกรูป");
    return NextResponse.json(await uploadImage(file, uid));
  } catch (e) {
    return fail(e);
  }
}
