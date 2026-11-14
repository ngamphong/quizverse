// Public Supabase settings (safe in the browser). Written out literally so Next.js inlines them.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const supabaseConfigured = !!(SUPABASE_URL && SUPABASE_KEY);
export const DB_OFF_NOTE = "ยังไม่ได้เชื่อมฐานข้อมูล: ผู้ดูแลต้องตั้งค่า Supabase ก่อน (ดู README)";
