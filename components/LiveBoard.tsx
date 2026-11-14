import { KEYS } from "@/lib/constants";
import type { LiveRow } from "@/lib/liveTypes";

/** Answer distribution after a reveal (how many picked A-D). */
export function Distribution({ counts, answer, choices }: { counts: number[]; answer: number; choices: string[] }) {
  const max = Math.max(1, ...counts);
  return (
    <div className="bars">
      {counts.map((n, i) => (
        <div className="bar" key={i} style={{ gridTemplateColumns: "minmax(0,1.4fr) 2fr 40px" }}>
          <span style={{ fontWeight: i === answer ? 700 : 400, color: i === answer ? "var(--ok)" : undefined, overflowWrap: "anywhere" }}>
            {KEYS[i]}. {choices[i]} {i === answer && "✓"}
          </span>
          <div className="track"><i style={{ width: `${(n / max) * 100}%`, background: i === answer ? "var(--ok)" : `var(--c${i + 1})` }} /></div>
          <b className="num" style={{ textAlign: "right" }}>{n}</b>
        </div>
      ))}
    </div>
  );
}

/** Ranked list of players. */
export function Leaderboard({ rows }: { rows: LiveRow[] }) {
  if (!rows.length) return <p className="small muted">ยังไม่มีผู้เล่น</p>;
  return (
    <div className="lb" style={{ background: "var(--surface-2)" }}>
      {rows.map((r, i) => (
        <div key={r.name + i} className={r.me ? "me" : ""} style={r.me ? { background: "var(--surface)" } : undefined}>
          <span>{i + 1}. {r.name}</span>
          <b className="num">{r.score.toLocaleString()}</b>
        </div>
      ))}
    </div>
  );
}
