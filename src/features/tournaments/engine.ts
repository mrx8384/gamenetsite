/**
 * Tournament engine — pure functions (no database), unit-tested in tests/unit/tournament-engine.test.ts.
 *
 * Bracket generation produces "match specs" that reference each other by local key. The service layer
 * persists them and resolves keys to database ids. Byes are explicit (a slot that will never receive a
 * player); `resolveByes` auto-completes matches where one side is a bye, which also handles byes that
 * cascade into the losers bracket of a double-elimination tournament.
 */

export type Stage = "WINNERS" | "LOSERS" | "GRAND_FINAL" | "GRAND_FINAL_RESET" | "THIRD_PLACE" | "ROUND_ROBIN" | "GROUP";

export interface MatchSpec {
  key: string;
  stage: Stage;
  round: number;
  position: number;
  groupIndex: number | null;
  player1: string | null;
  player2: string | null;
  player1Bye: boolean;
  player2Bye: boolean;
  next: { key: string; slot: 1 | 2 } | null;
  loser: { key: string; slot: 1 | 2 } | null;
}

const spec = (p: Partial<MatchSpec> & Pick<MatchSpec, "key" | "stage" | "round" | "position">): MatchSpec => ({
  groupIndex: null,
  player1: null,
  player2: null,
  player1Bye: false,
  player2Bye: false,
  next: null,
  loser: null,
  ...p,
});

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Standard seeding order for a bracket of `size` (power of two): seed 1 meets the last seed, seeds
 * 1 and 2 can only meet in the final. Returns seed numbers (1-based) in slot order.
 */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

/** Players in seed order → first-round slots; missing seeds become byes (top seeds get the byes). */
function firstRoundSlots(players: string[], size: number): (string | null)[] {
  return seedOrder(size).map((seed) => players[seed - 1] ?? null);
}

// ───────────── Single elimination ─────────────

export function singleElimination(players: string[], opts: { thirdPlace?: boolean; keyPrefix?: string } = {}): MatchSpec[] {
  if (players.length < 2) throw new Error("At least 2 participants are required");
  const prefix = opts.keyPrefix ?? "W";
  const size = nextPowerOfTwo(players.length);
  const rounds = Math.log2(size);
  const slots = firstRoundSlots(players, size);
  const matches: MatchSpec[] = [];
  for (let r = 1; r <= rounds; r++) {
    const count = size / 2 ** r;
    for (let i = 0; i < count; i++) {
      const m = spec({ key: `${prefix}${r}-${i}`, stage: "WINNERS", round: r, position: i });
      if (r === 1) {
        m.player1 = slots[i * 2];
        m.player2 = slots[i * 2 + 1];
        m.player1Bye = m.player1 === null;
        m.player2Bye = m.player2 === null;
      }
      if (r < rounds) m.next = { key: `${prefix}${r + 1}-${Math.floor(i / 2)}`, slot: (i % 2) + 1 as 1 | 2 };
      matches.push(m);
    }
  }
  if (opts.thirdPlace && rounds >= 2) {
    const third = spec({ key: `${prefix}3rd`, stage: "THIRD_PLACE", round: rounds, position: 1 });
    matches.push(third);
    for (const semi of matches.filter((m) => m.stage === "WINNERS" && m.round === rounds - 1)) {
      semi.loser = { key: third.key, slot: (semi.position % 2) + 1 as 1 | 2 };
    }
  }
  return matches;
}

// ───────────── Double elimination ─────────────

/**
 * Winners bracket + losers bracket + grand final (+ reset). For a bracket of size P = 2^k the losers
 * bracket has 2(k-1) rounds: odd rounds pair losers-bracket survivors (round 1 pairs winners-round-1
 * losers), even rounds bring in the losers of the next winners round. Dropped losers are placed in
 * reverse order to reduce early rematches.
 */
export function doubleElimination(players: string[]): MatchSpec[] {
  if (players.length < 2) throw new Error("At least 2 participants are required");
  const size = nextPowerOfTwo(players.length);
  const k = Math.log2(size);
  const wb = singleElimination(players, { keyPrefix: "W" });
  const byKey = new Map(wb.map((m) => [m.key, m]));

  if (size === 2) {
    // Two players: final, then a reset match if the "losers" side wins.
    const final = wb[0];
    const gf = spec({ key: "GF", stage: "GRAND_FINAL", round: 1, position: 0 });
    const reset = spec({ key: "GFR", stage: "GRAND_FINAL_RESET", round: 2, position: 0 });
    final.next = { key: gf.key, slot: 1 };
    final.loser = { key: gf.key, slot: 2 };
    gf.next = { key: reset.key, slot: 1 };
    return [final, gf, reset];
  }

  const lb: MatchSpec[] = [];
  const lbRounds = 2 * (k - 1);
  for (let r = 1; r <= lbRounds; r++) {
    // Matches per LB round: P/4, P/4, P/8, P/8, ...
    const count = size / 2 ** (Math.floor((r + 1) / 2) + 1);
    for (let i = 0; i < count; i++) lb.push(spec({ key: `L${r}-${i}`, stage: "LOSERS", round: r, position: i }));
  }
  const lbAt = (r: number, i: number) => `L${r}-${i}`;

  // Winners round 1 losers → LB round 1 (two per match).
  for (const m of wb.filter((x) => x.round === 1)) {
    m.loser = { key: lbAt(1, Math.floor(m.position / 2)), slot: (m.position % 2) + 1 as 1 | 2 };
  }
  // Winners round r (r ≥ 2) losers → LB round 2(r-1), slot 2, reversed order.
  for (let r = 2; r <= k; r++) {
    const wr = wb.filter((x) => x.round === r);
    const lbRound = 2 * (r - 1);
    const count = wr.length;
    for (const m of wr) {
      const target = r % 2 === 0 ? count - 1 - m.position : m.position;
      m.loser = { key: lbAt(lbRound, target), slot: 2 };
    }
  }
  // LB internal links.
  for (const m of lb) {
    const r = m.round;
    if (r === lbRounds) continue;
    if (r % 2 === 1) {
      // odd → next even round, same position, slot 1 (WB losers arrive in slot 2)
      m.next = { key: lbAt(r + 1, m.position), slot: 1 };
    } else {
      // even → next odd round, pairs merge
      m.next = { key: lbAt(r + 1, Math.floor(m.position / 2)), slot: (m.position % 2) + 1 as 1 | 2 };
    }
  }
  const gf = spec({ key: "GF", stage: "GRAND_FINAL", round: 1, position: 0 });
  const reset = spec({ key: "GFR", stage: "GRAND_FINAL_RESET", round: 2, position: 0 });
  const wbFinal = byKey.get(`W${k}-0`)!;
  wbFinal.next = { key: gf.key, slot: 1 };
  lb.find((m) => m.round === lbRounds)!.next = { key: gf.key, slot: 2 };
  gf.next = { key: reset.key, slot: 1 };
  return [...wb, ...lb, gf, reset];
}

// ───────────── Round robin / groups ─────────────

/** Circle method. Each pair meets once (or twice with home/away swapped when `double`). */
export function roundRobin(players: string[], opts: { double?: boolean; groupIndex?: number | null; keyPrefix?: string; stage?: Stage } = {}): MatchSpec[] {
  if (players.length < 2) throw new Error("At least 2 participants are required");
  const list: (string | null)[] = [...players];
  if (list.length % 2 === 1) list.push(null);
  const n = list.length;
  const rounds: [string, string][][] = [];
  const rot = list.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const current = [list[0], ...rot];
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = current[i];
      const b = current[n - 1 - i];
      if (a && b) pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    rot.unshift(rot.pop()!);
  }
  const all = opts.double ? [...rounds, ...rounds.map((pairs) => pairs.map(([a, b]) => [b, a] as [string, string]))] : rounds;
  const prefix = opts.keyPrefix ?? "R";
  return all.flatMap((pairs, r) =>
    pairs.map(([a, b], i) =>
      spec({ key: `${prefix}${r + 1}-${i}`, stage: opts.stage ?? "ROUND_ROBIN", round: r + 1, position: i, groupIndex: opts.groupIndex ?? null, player1: a, player2: b }),
    ),
  );
}

/** Snake distribution by seed: groups get balanced strength (1,2,3,4 | 8,7,6,5 | ...). */
export function distributeGroups(players: string[], groupCount: number): string[][] {
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  players.forEach((p, i) => {
    const row = Math.floor(i / groupCount);
    const col = i % groupCount;
    groups[row % 2 === 0 ? col : groupCount - 1 - col].push(p);
  });
  return groups;
}

export function groupStage(players: string[], groupCount: number, double = false): { groups: string[][]; matches: MatchSpec[] } {
  if (groupCount < 1) throw new Error("groupCount must be ≥ 1");
  if (players.length < groupCount * 2) throw new Error("Each group needs at least 2 participants");
  const groups = distributeGroups(players, groupCount);
  const matches = groups.flatMap((g, gi) => roundRobin(g, { double, groupIndex: gi, keyPrefix: `G${gi}-`, stage: "GROUP" }));
  return { groups, matches };
}

/**
 * Knockout seeding from group results: all group winners first (A1, B1, C1…), then all runners-up in
 * the same group order (A2, B2…), and so on. With standard bracket seeding (1 v n, 2 v n-1…) a group
 * winner never meets a team from its own group in the first round.
 */
export function knockoutSeeds(qualifiedByGroup: string[][]): string[] {
  const out: string[] = [];
  const depth = Math.max(...qualifiedByGroup.map((g) => g.length));
  for (let place = 0; place < depth; place++) {
    for (const g of qualifiedByGroup) if (g[place]) out.push(g[place]);
  }
  return out;
}

// ───────────── Byes ─────────────

export interface LiveMatch {
  key: string;
  player1: string | null;
  player2: string | null;
  player1Bye: boolean;
  player2Bye: boolean;
  status: "PENDING" | "COMPLETED" | "SKIPPED";
  winnerSlot: 1 | 2 | null;
  next: { key: string; slot: 1 | 2 } | null;
  loser: { key: string; slot: 1 | 2 } | null;
}

/**
 * Auto-completes matches where one side is a bye (and the other side is known or also a bye),
 * propagating the winner (and the bye as "loser") forward. Mutates and returns the changed keys.
 */
export function resolveByes(matches: Map<string, LiveMatch>): string[] {
  const changed: string[] = [];
  let progress = true;
  while (progress) {
    progress = false;
    for (const m of matches.values()) {
      if (m.status !== "PENDING") continue;
      const oneBye = m.player1Bye || m.player2Bye;
      if (!oneBye) continue;
      const otherKnown = m.player1Bye ? m.player2 !== null || m.player2Bye : m.player1 !== null || m.player1Bye;
      if (!otherKnown) continue;
      const bothBye = m.player1Bye && m.player2Bye;
      m.status = "COMPLETED";
      m.winnerSlot = m.player1Bye ? 2 : 1;
      const winner = bothBye ? null : m.player1Bye ? m.player2 : m.player1;
      place(matches, m.next, winner, bothBye);
      place(matches, m.loser, null, true);
      // Report the filled matches too: callers persist only the keys returned here.
      changed.push(m.key);
      if (m.next) changed.push(m.next.key);
      if (m.loser) changed.push(m.loser.key);
      progress = true;
    }
  }
  return changed;
}

function place(matches: Map<string, LiveMatch>, target: { key: string; slot: 1 | 2 } | null, player: string | null, bye: boolean) {
  if (!target) return;
  const t = matches.get(target.key);
  if (!t) return;
  if (target.slot === 1) {
    t.player1 = player;
    t.player1Bye = bye;
  } else {
    t.player2 = player;
    t.player2Bye = bye;
  }
}

// ───────────── Standings ─────────────

export interface ResultRow {
  player1: string;
  player2: string;
  score1: number;
  score2: number;
}

export interface Standing {
  id: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

/** League table: points, then goal difference, goals scored, head-to-head points, then seed order. */
export function standings(players: string[], results: ResultRow[], pts: { win: number; draw: number; loss: number }): Standing[] {
  const table = new Map<string, Standing>(players.map((id) => [id, { id, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 }]));
  for (const r of results) {
    const a = table.get(r.player1);
    const b = table.get(r.player2);
    if (!a || !b) continue;
    a.played++;
    b.played++;
    a.goalsFor += r.score1;
    a.goalsAgainst += r.score2;
    b.goalsFor += r.score2;
    b.goalsAgainst += r.score1;
    if (r.score1 > r.score2) {
      a.won++;
      b.lost++;
      a.points += pts.win;
      b.points += pts.loss;
    } else if (r.score1 < r.score2) {
      b.won++;
      a.lost++;
      b.points += pts.win;
      a.points += pts.loss;
    } else {
      a.drawn++;
      b.drawn++;
      a.points += pts.draw;
      b.points += pts.draw;
    }
  }
  for (const s of table.values()) s.goalDiff = s.goalsFor - s.goalsAgainst;
  const seedIndex = new Map(players.map((id, i) => [id, i]));
  const h2h = (x: string, y: string) => {
    let px = 0;
    let py = 0;
    for (const r of results) {
      const pair = (r.player1 === x && r.player2 === y) || (r.player1 === y && r.player2 === x);
      if (!pair) continue;
      const sx = r.player1 === x ? r.score1 : r.score2;
      const sy = r.player1 === x ? r.score2 : r.score1;
      if (sx > sy) px += pts.win;
      else if (sx < sy) py += pts.win;
      else {
        px += pts.draw;
        py += pts.draw;
      }
    }
    return py - px;
  };
  return [...table.values()].sort(
    (a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor || h2h(a.id, b.id) || seedIndex.get(a.id)! - seedIndex.get(b.id)!,
  );
}

// ───────────── Labels ─────────────

/** Persian round name for an elimination bracket round. */
export function eliminationRoundName(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "فینال";
  if (fromEnd === 1) return "نیمه‌نهایی";
  if (fromEnd === 2) return "یک‌چهارم نهایی";
  if (fromEnd === 3) return "یک‌هشتم نهایی";
  return `دور ${round.toLocaleString("fa-IR")}`;
}

// ───────────── Results (elimination stages) ─────────────

export class BracketError extends Error {
  constructor(public readonly code: "not_ready" | "downstream_played" | "not_found" | "bye") {
    super(code);
  }
}

function getSlot(m: LiveMatch, slot: 1 | 2): string | null {
  return slot === 1 ? m.player1 : m.player2;
}

function setSlot(m: LiveMatch, slot: 1 | 2, player: string | null, bye = false) {
  if (slot === 1) {
    m.player1 = player;
    m.player1Bye = bye;
  } else {
    m.player2 = player;
    m.player2Bye = bye;
  }
}

/** True when a completed match was decided only because the other side is a bye. */
function isByeWin(m: LiveMatch): boolean {
  return m.status === "COMPLETED" && (m.player1Bye || m.player2Bye);
}

/**
 * Clears the effects of `m`'s result downstream (removes the players it placed). Byes that were
 * auto-completed because of this result are undone recursively. Throws if a real result downstream
 * would be affected.
 */
function undoDownstream(matches: Map<string, LiveMatch>, m: LiveMatch, changed: Set<string>, isGrandFinal: boolean) {
  const targets: { key: string; slot: 1 | 2 }[] = [];
  if (m.next) targets.push(m.next);
  if (m.loser) targets.push(m.loser);
  for (const t of targets) {
    const target = matches.get(t.key);
    if (!target) continue;
    if (isGrandFinal) {
      // Grand final → reset match: either skipped (WB champion won) or seeded with both players.
      if (target.status === "COMPLETED") throw new BracketError("downstream_played");
      target.status = "PENDING";
      target.player1 = target.player2 = null;
      target.player1Bye = target.player2Bye = false;
      target.winnerSlot = null;
      changed.add(target.key);
      continue;
    }
    if (target.status === "COMPLETED") {
      if (!isByeWin(target)) throw new BracketError("downstream_played");
      undoDownstream(matches, target, changed, false);
      target.status = "PENDING";
      target.winnerSlot = null;
    }
    setSlot(target, t.slot, null, false);
    changed.add(target.key);
  }
}

/**
 * Records the winner of an elimination match and advances players. Re-reporting a played match is
 * allowed while nothing downstream has been played. `stageOf(key)` tells grand-final semantics.
 */
export function applyResult(matches: Map<string, LiveMatch>, key: string, winnerSlot: 1 | 2, stageOf: (key: string) => Stage): string[] {
  const m = matches.get(key);
  if (!m) throw new BracketError("not_found");
  if (m.player1Bye || m.player2Bye) throw new BracketError("bye");
  if (!m.player1 || !m.player2) throw new BracketError("not_ready");
  const changed = new Set<string>([key]);
  const isGF = stageOf(key) === "GRAND_FINAL";
  if (m.status === "COMPLETED") undoDownstream(matches, m, changed, isGF);

  m.status = "COMPLETED";
  m.winnerSlot = winnerSlot;
  const winner = getSlot(m, winnerSlot)!;
  const loser = getSlot(m, winnerSlot === 1 ? 2 : 1)!;

  if (isGF) {
    const reset = m.next ? matches.get(m.next.key) : undefined;
    if (reset) {
      if (winnerSlot === 1) {
        reset.status = "SKIPPED"; // winners-bracket champion won: no reset needed
      } else {
        reset.status = "PENDING";
        reset.player1 = m.player1;
        reset.player2 = m.player2;
        reset.player1Bye = reset.player2Bye = false;
      }
      changed.add(reset.key);
    }
  } else {
    if (m.next) {
      const t = matches.get(m.next.key);
      if (t) {
        setSlot(t, m.next.slot, winner, false);
        changed.add(t.key);
      }
    }
    if (m.loser) {
      const t = matches.get(m.loser.key);
      if (t) {
        setSlot(t, m.loser.slot, loser, false);
        changed.add(t.key);
      }
    }
  }
  for (const k of resolveByes(matches)) changed.add(k);
  return [...changed];
}

/** Removes a result (and what it advanced) while nothing downstream has been played. */
export function clearResult(matches: Map<string, LiveMatch>, key: string, stageOf: (key: string) => Stage): string[] {
  const m = matches.get(key);
  if (!m) throw new BracketError("not_found");
  if (m.status !== "COMPLETED" || isByeWin(m)) return [];
  const changed = new Set<string>([key]);
  undoDownstream(matches, m, changed, stageOf(key) === "GRAND_FINAL");
  m.status = "PENDING";
  m.winnerSlot = null;
  return [...changed];
}

/** Builds the live map used by resolveByes/applyResult from freshly generated specs. */
export function toLive(specs: MatchSpec[]): Map<string, LiveMatch> {
  return new Map(
    specs.map((s) => [
      s.key,
      { key: s.key, player1: s.player1, player2: s.player2, player1Bye: s.player1Bye, player2Bye: s.player2Bye, status: "PENDING", winnerSlot: null, next: s.next, loser: s.loser },
    ]),
  );
}
