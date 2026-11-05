/**
 * Prediction counts and scores (pure). A prediction only counts while it names one of the match's
 * current players (the bracket may change them when an earlier result is corrected). Forfeits and
 * byes are not scored.
 */
export interface PredMatch {
  id: string;
  player1Id: string | null;
  player2Id: string | null;
  status: string;
  winnerId: string | null;
  forfeit: boolean;
}
export interface Pred {
  matchId: string;
  userId: string;
  participantId: string;
}

export function predictionSummary(matches: PredMatch[], preds: Pred[]) {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const counts: Record<string, Record<string, number>> = {};
  const scores = new Map<string, { correct: number; decided: number }>();
  for (const p of preds) {
    const m = byId.get(p.matchId);
    if (!m || !m.player1Id || !m.player2Id || (p.participantId !== m.player1Id && p.participantId !== m.player2Id)) continue;
    (counts[m.id] ??= {})[p.participantId] = (counts[m.id]?.[p.participantId] ?? 0) + 1;
    if (m.status === "COMPLETED" && m.winnerId && !m.forfeit) {
      const s = scores.get(p.userId) ?? { correct: 0, decided: 0 };
      s.decided++;
      if (m.winnerId === p.participantId) s.correct++;
      scores.set(p.userId, s);
    }
  }
  const ranking = [...scores.entries()]
    .map(([userId, s]) => ({ userId, ...s }))
    .sort((a, b) => b.correct - a.correct || a.decided - b.decided || a.userId.localeCompare(b.userId));
  return { counts, ranking };
}

/** Public display name for a predictor: first word only (accounts' full names stay private). */
export const predictorName = (fullName: string) => (fullName.trim().split(/\s+/)[0] || "کاربر").slice(0, 30);
