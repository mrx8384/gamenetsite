import { groupStage, singleElimination, swissPairings } from "./engine";

/**
 * What starting the tournament will produce from the current participant order (pure).
 * Uses the same engine functions as `startTournament`, so the preview is exactly the real result
 * (players removed by check-in at the start change it, of course).
 */
export type StartPreview =
  | { kind: "pairs"; label: string; pairs: { a: string | null; b: string | null }[]; bye: string | null }
  | { kind: "groups"; groups: string[][] };

export function startPreview(t: { format: string; groupCount: number | null; doubleRoundRobin: boolean }, ids: string[]): StartPreview | null {
  if (ids.length < 2) return null;
  switch (t.format) {
    case "SINGLE_ELIMINATION":
    case "DOUBLE_ELIMINATION": {
      // Double elimination opens with the same winners-bracket round as single elimination.
      const first = singleElimination(ids)
        .filter((m) => m.stage === "WINNERS" && m.round === 1)
        .sort((a, b) => a.position - b.position);
      return { kind: "pairs", label: "دور اول", pairs: first.map((m) => ({ a: m.player1, b: m.player2 })), bye: null };
    }
    case "SWISS": {
      const r = swissPairings(ids, { round: 1, played: new Set(), hadBye: new Set() });
      return { kind: "pairs", label: "دور ۱ سوئیسی", pairs: r.pairs.map(([a, b]) => ({ a, b })), bye: r.bye };
    }
    case "GROUPS_KNOCKOUT": {
      const n = t.groupCount ?? 1;
      if (ids.length < n * 2) return null;
      return { kind: "groups", groups: groupStage(ids, n, t.doubleRoundRobin).groups };
    }
    default:
      return null; // round robin: everyone meets everyone; leaderboard: no matches
  }
}
