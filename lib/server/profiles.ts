import "server-only";
import { emptyProfile } from "../profile";
import { supabaseAdmin } from "../supabase/server";
import type { Profile } from "../types";
import { HttpError } from "./http";

/** Learning DNA is stored as JSON in profiles.learning; name and role live in their own columns. */
export function rowToProfile(row: { display_name: string; learning: unknown }): Profile {
  const base = emptyProfile(row.display_name);
  const l = (row.learning && typeof row.learning === "object" ? row.learning : {}) as Partial<Profile>;
  return {
    ...base, ...l,
    stats: { ...base.stats, ...(l.stats ?? {}) },
    conf: { ...base.conf, ...(l.conf ?? {}) },
    revision: Array.isArray(l.revision) ? l.revision : [],
    name: row.display_name, example: false,
  };
}

export function toLearning(p: Profile) {
  const { name: _n, example: _e, ...rest } = p;
  return rest;
}

export async function loadProfileRow(userId: string) {
  const { data } = await supabaseAdmin().from("profiles").select("display_name, role, learning").eq("id", userId).maybeSingle();
  return data ? { display_name: data.display_name as string, role: data.role as "teacher" | "student", profile: rowToProfile(data) } : null;
}

export async function saveLearning(userId: string, p: Profile) {
  const learning = toLearning(p);
  if (JSON.stringify(learning).length > 200_000) throw new HttpError(413, "ข้อมูลการเรียนรู้ใหญ่เกินไป");
  const { error } = await supabaseAdmin().from("profiles").update({ learning }).eq("id", userId);
  if (error) throw new HttpError(500, "บันทึก Learning DNA ไม่สำเร็จ");
}
