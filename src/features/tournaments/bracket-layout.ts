/**
 * Positions of an elimination bracket for drawing (Challonge-style columns with connector lines).
 * Pure and unit-tested: rounds become columns; a match sits midway between the matches that feed it
 * (via `nextMatchId`); matches without feeders stack in order. Columns run right-to-left (RTL).
 */
export interface LayoutMatch {
  id: string;
  round: number;
  position: number;
  nextMatchId: string | null;
}

export interface BracketBox {
  id: string;
  x: number;
  y: number;
}

export interface BracketLine {
  from: string;
  to: string;
  d: string;
}

export interface BracketLayout {
  width: number;
  height: number;
  rounds: { round: number; x: number }[];
  boxes: Map<string, BracketBox>;
  lines: BracketLine[];
}

export function bracketLayout(matches: LayoutMatch[], size: { w: number; h: number; gapX: number; gapY: number }): BracketLayout {
  const { w, h, gapX, gapY } = size;
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  const width = rounds.length * w + Math.max(0, rounds.length - 1) * gapX;
  const xOf = (col: number) => width - (col + 1) * w - col * gapX; // round 1 on the right
  const inSection = new Set(matches.map((m) => m.id));
  const feeders = new Map<string, string[]>();
  for (const m of matches) {
    if (m.nextMatchId && inSection.has(m.nextMatchId)) feeders.set(m.nextMatchId, [...(feeders.get(m.nextMatchId) ?? []), m.id]);
  }
  const boxes = new Map<string, BracketBox>();
  rounds.forEach((r, col) => {
    const list = matches.filter((m) => m.round === r).sort((a, b) => a.position - b.position);
    let cursor = 0;
    for (const m of list) {
      const fed = (feeders.get(m.id) ?? []).map((id) => boxes.get(id)).filter((b): b is BracketBox => !!b);
      let y = fed.length ? fed.reduce((s, b) => s + b.y, 0) / fed.length : cursor;
      y = Math.max(y, cursor); // never overlap the box above
      boxes.set(m.id, { id: m.id, x: xOf(col), y });
      cursor = y + h + gapY;
    }
  });
  const height = Math.max(h, ...[...boxes.values()].map((b) => b.y + h));
  const lines: BracketLine[] = [];
  for (const m of matches) {
    const a = boxes.get(m.id);
    const b = m.nextMatchId ? boxes.get(m.nextMatchId) : undefined;
    if (!a || !b) continue;
    const ax = a.x; // left edge (RTL: the next round is to the left)
    const ay = a.y + h / 2;
    const bx = b.x + w;
    const by = b.y + h / 2;
    const mid = Math.round((ax + bx) / 2);
    lines.push({ from: m.id, to: b.id, d: `M${ax} ${ay} H${mid} V${by} H${bx}` });
  }
  return { width, height, rounds: rounds.map((round, col) => ({ round, x: xOf(col) })), boxes, lines };
}
