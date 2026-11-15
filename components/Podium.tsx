import type { ReactNode } from "react";

export interface PodiumRow { name: string; score: number; me?: boolean; bot?: boolean; rank?: number }

/** Purple results panel: top-3 podium (2-1-3) and the ranked list. Used by solo results and live rooms. */
export default function Podium({ title, rows, note, big }: { title: ReactNode; rows: PodiumRow[]; note?: ReactNode; big?: boolean }) {
  const top = rows.filter((r) => !r.rank).slice(0, 3);
  return (
    <div className={"podium-wrap" + (big ? " big" : "")}>
      <h2 style={{ fontSize: big ? 32 : 26 }}>{title}</h2>
      {top.length > 0 && (
        <div className="podium">
          {[1, 0, 2].filter((i) => top[i]).map((i) => (
            <div key={i} className={`pod p${i + 1}${top[i].me ? " me" : ""}`}>
              <span className="who">{top[i].name}</span>
              <span className="pts num">{top[i].score.toLocaleString()} คะแนน</span>
              <div className="block">{i + 1}</div>
            </div>
          ))}
        </div>
      )}
      {rows.length > 0 ? (
        <div className="lb">
          {rows.map((p, i) => (
            <div key={p.name + i} className={p.me ? "me" : ""}>
              <span>{p.rank && <span style={{ opacity: 0.6 }}>⋯ </span>}{p.rank ?? i + 1}. {p.name}{p.bot && <span style={{ opacity: 0.7, fontSize: 12 }}> (จำลอง)</span>}</span>
              <b className="num">{p.score.toLocaleString()}</b>
            </div>
          ))}
        </div>
      ) : <p className="small" style={{ opacity: 0.85 }}>ยังไม่มีผู้เล่น</p>}
      {note && <p className="small" style={{ opacity: 0.85 }}>{note}</p>}
    </div>
  );
}
