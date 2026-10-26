/**
 * Friendly air-hockey tournament on one device (phase 13): single elimination for 4 or 8 players.
 * Every match is a two-player match on the same phone; the bracket is saved in the browser so a
 * tournament survives closing the page.
 */
export interface Match {
  /** player indexes into `players`; null until the earlier match is decided */
  a: number | null;
  b: number | null;
  winner: number | null;
  score: [number, number] | null;
}

export interface Tournament {
  version: 1;
  players: string[];
  /** goals needed to win a match */
  winScore: number;
  /** rounds[0] = first round … last = final */
  rounds: Match[][];
  createdAt: number;
}

export const SIZES = [4, 8] as const;
export const WIN_SCORES = [3, 5] as const;
const KEY = "atom-world:hockey-tournament";

export const roundName = (round: number, total: number) => (round === total - 1 ? "فینال" : round === total - 2 ? "نیمه‌نهایی" : round === total - 3 ? "یک‌چهارم نهایی" : `دور ${round + 1}`);

/** Visible names: trimmed, no markup, unique, ≤ 16 characters; empty → «بازیکن n». */
export function cleanNames(raw: string[]) {
  const out: string[] = [];
  raw.forEach((r, i) => {
    let n = r.replace(/[\u0000-\u001f\u007f<>{}[\]\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 16) || `بازیکن ${(i + 1).toLocaleString("fa-IR")}`;
    let k = 2;
    const base = n;
    while (out.includes(n)) n = `${base} ${(k++).toLocaleString("fa-IR")}`;
    out.push(n);
  });
  return out;
}

/** Fisher–Yates with an injectable random (tests). */
export function shuffled<T>(list: T[], rand = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createTournament(names: string[], winScore = 3, shuffle = true, rand = Math.random): Tournament {
  if (!SIZES.includes(names.length as 4 | 8)) throw new Error("4 or 8 players");
  const players = shuffle ? shuffled(cleanNames(names), rand) : cleanNames(names);
  const rounds: Match[][] = [];
  let count = players.length / 2;
  rounds.push(Array.from({ length: count }, (_, i) => ({ a: i * 2, b: i * 2 + 1, winner: null, score: null })));
  while (count > 1) {
    count /= 2;
    rounds.push(Array.from({ length: count }, () => ({ a: null, b: null, winner: null, score: null })));
  }
  return { version: 1, players, winScore: WIN_SCORES.includes(winScore as 3 | 5) ? winScore : 3, rounds, createdAt: Date.now() };
}

/** The next match to play, or null when the champion is known. */
export function nextMatch(t: Tournament): { round: number; index: number; match: Match } | null {
  for (let r = 0; r < t.rounds.length; r++)
    for (let i = 0; i < t.rounds[r].length; i++) {
      const m = t.rounds[r][i];
      if (m.winner === null && m.a !== null && m.b !== null) return { round: r, index: i, match: m };
    }
  return null;
}

/** Records a result (`side` 0 = player a won) and moves the winner on. Returns a new tournament. */
export function reportResult(t: Tournament, round: number, index: number, side: 0 | 1, score: [number, number]): Tournament {
  const rounds = t.rounds.map((r) => r.map((m) => ({ ...m })));
  const m = rounds[round]?.[index];
  if (!m || m.a === null || m.b === null || m.winner !== null) return t;
  m.winner = side === 0 ? m.a : m.b;
  m.score = score;
  const next = rounds[round + 1]?.[Math.floor(index / 2)];
  if (next) {
    if (index % 2 === 0) next.a = m.winner;
    else next.b = m.winner;
  }
  return { ...t, rounds };
}

export function champion(t: Tournament): number | null {
  return t.rounds[t.rounds.length - 1][0].winner;
}

function valid(t: unknown): t is Tournament {
  if (!t || typeof t !== "object") return false;
  const o = t as Tournament;
  return o.version === 1 && Array.isArray(o.players) && SIZES.includes(o.players.length as 4 | 8) && o.players.every((p) => typeof p === "string") && Array.isArray(o.rounds) && WIN_SCORES.includes(o.winScore as 3 | 5);
}

export function loadTournament(): Tournament | null {
  try {
    const t = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    return valid(t) ? t : null;
  } catch {
    return null;
  }
}

export function saveTournament(t: Tournament | null) {
  try {
    if (t) window.localStorage.setItem(KEY, JSON.stringify(t));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* private mode: the bracket lives only in this page */
  }
}
