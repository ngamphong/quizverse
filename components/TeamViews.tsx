import { KEYS } from "@/lib/constants";
import type { TeamReveal, TeamRow, TeamVote } from "@/lib/liveTypes";

/** Team ranking for Collaborative Challenge. */
export function TeamBoard({ teams }: { teams: TeamRow[] }) {
  return (
    <div className="lb" style={{ background: "var(--surface-2)" }}>
      {teams.map((t, i) => (
        <div key={t.team} className={t.mine ? "me" : ""} style={t.mine ? { background: "var(--surface)" } : undefined}>
          <span>{i + 1}. <b>{t.name}</b> <span className="small muted">({t.members.join(", ")})</span></span>
          <b className="num">{t.score.toLocaleString()}</b>
        </div>
      ))}
    </div>
  );
}

/** Teammates' current votes and reasons (while answering, own team only). */
export function TeamVotes({ votes, choices }: { votes: TeamVote[]; choices: string[] }) {
  if (!votes.length) return <p className="small muted">ยังไม่มีเพื่อนในทีมตอบ</p>;
  return (
    <div className="grid" style={{ gap: 6 }}>
      {votes.map((v, i) => (
        <div key={i} className="alert info" style={{ flexDirection: "column", gap: 2 }}>
          <span><b>{v.name}</b> เลือก {v.choice >= 0 ? `${KEYS[v.choice]}. ${choices[v.choice]}` : "ไม่ได้ตอบ"}</span>
          {v.reason && <span className="small">“{v.reason}”</span>}
        </div>
      ))}
    </div>
  );
}

/** After the reveal: each team's majority answer, points and the reasons behind it. */
export function TeamRevealList({ teams, choices, myTeam }: { teams: TeamReveal[]; choices: string[]; myTeam?: number | null }) {
  return (
    <div className="grid" style={{ gap: 10 }}>
      {teams.map((t) => (
        <div key={t.team} className="qstat" style={{ borderColor: t.correct ? "var(--ok)" : "var(--line)", background: t.team === myTeam ? "var(--surface-2)" : undefined }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <b>{t.name}{t.team === myTeam ? " (ทีมของคุณ)" : ""}</b>
            <span className={"pill " + (t.correct ? "ok" : "bad")}>+{t.points}</span>
          </div>
          <p className="small">
            คำตอบของทีม: {t.choice != null ? `${KEYS[t.choice]}. ${choices[t.choice]}` : "ไม่มีใครตอบ"} {t.correct ? "✓ ถูก" : "✗"}
            {t.allReasoned ? " · ทุกคนให้เหตุผล +200" : " · ยังมีคนไม่ได้ให้เหตุผล"}
          </p>
          {t.votes.map((v, i) => (
            <p key={i} className="small muted">• {v.name}: {v.choice >= 0 ? KEYS[v.choice] : "-"}{v.reason ? ` — “${v.reason}”` : ""}</p>
          ))}
        </div>
      ))}
    </div>
  );
}
