/** Short Thai date-time, e.g. "15 พ.ย. 14:05". */
export const fmtDate = (s: string) =>
  s ? new Date(s).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";
