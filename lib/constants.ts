export const SUBJECTS = ["วิทยาศาสตร์", "คณิตศาสตร์", "ภาษาอังกฤษ", "ภาษาไทย", "สังคมศึกษา"];
export const LEVEL: Record<number, string> = { 1: "ง่าย", 2: "ปานกลาง", 3: "ยาก" };
export const DAY = 86_400_000;
/** Smart Revision: days until the next review after each successful round */
export const INTERVALS = [1, 3, 7, 14];
export const TIME_LIMIT = 20; // seconds per question
export const ROUNDS = 8; // questions per live game
export const KEYS = "ABCD";
export const CONF_TXT: Record<string, string> = { sure: "มั่นใจมาก", mid: "ปานกลาง", guess: "เดา", none: "หมดเวลา" };
