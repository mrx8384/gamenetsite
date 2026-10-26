import "server-only";
import { randomBytes, randomInt } from "node:crypto";

/**
 * Online rooms for two friends (phase 10): a tiny message relay kept in this server's memory.
 * One room = a 5-digit code + two seats. Each seat has a secret token; messages from one seat are
 * passed on to the other (Server-Sent Events down, POST up). Nothing is stored on disk and no
 * personal data is kept: a display name (≤ 20 characters) and the game id, for at most 15 idle minutes.
 *
 * Runs in one Node process (`next start`). Several processes behind a load balancer would need a
 * shared store (e.g. Redis) instead of this Map — see docs/ONLINE.md.
 */
export const GAMES = ["air-hockey", "foot-pool"] as const;
export type OnlineGame = (typeof GAMES)[number];

const LIMITS = {
  rooms: 300,
  idleMs: 15 * 60 * 1000,
  msgBytes: 4096,
  msgsPerPost: 30,
  /** messages per seat per second */
  rate: 80,
  queue: 200,
} as const;

type Push = (event: string, data: string) => void;

interface Seat {
  token: string;
  name: string;
  push: Push | null;
  queue: { event: string; data: string }[];
  window: { start: number; count: number };
}

interface Room {
  code: string;
  game: OnlineGame;
  seats: [Seat, Seat | null];
  lastActive: number;
}

const g = globalThis as unknown as { __atomRooms?: Map<string, Room>; __atomRoomsSweep?: ReturnType<typeof setInterval> };
const rooms = (g.__atomRooms ??= new Map<string, Room>());
if (!g.__atomRoomsSweep) {
  g.__atomRoomsSweep = setInterval(sweep, 60_000);
  g.__atomRoomsSweep.unref?.();
}

function sweep(now = Date.now()) {
  for (const [code, r] of rooms) if (now - r.lastActive > LIMITS.idleMs) rooms.delete(code);
}

export function cleanName(raw: unknown) {
  const s = typeof raw === "string" ? raw : "";
  return (
    s
      .replace(/[\u0000-\u001f\u007f<>{}[\]\\]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 20) || "دوست"
  );
}

function newSeat(name: string): Seat {
  return { token: randomBytes(18).toString("base64url"), name, push: null, queue: [], window: { start: 0, count: 0 } };
}

export type RoomError = "full" | "not-found" | "busy" | "bad-request" | "forbidden" | "rate";

export function createRoom(game: unknown, name: unknown): { code: string; token: string } | { error: RoomError } {
  if (!GAMES.includes(game as OnlineGame)) return { error: "bad-request" };
  sweep();
  if (rooms.size >= LIMITS.rooms) return { error: "busy" };
  let code = "";
  for (let i = 0; i < 20 && (!code || rooms.has(code)); i++) code = String(randomInt(10000, 100000));
  if (rooms.has(code)) return { error: "busy" };
  const host = newSeat(cleanName(name));
  rooms.set(code, { code, game: game as OnlineGame, seats: [host, null], lastActive: Date.now() });
  return { code, token: host.token };
}

export function joinRoom(code: string, name: unknown): { token: string; game: OnlineGame; hostName: string } | { error: RoomError } {
  const r = rooms.get(code);
  if (!r) return { error: "not-found" };
  if (r.seats[1]) return { error: "full" };
  const guest = newSeat(cleanName(name));
  r.seats[1] = guest;
  r.lastActive = Date.now();
  // tell the host who joined
  deliver(r.seats[0], "peer", JSON.stringify({ t: "joined", name: guest.name }));
  return { token: guest.token, game: r.game, hostName: r.seats[0].name };
}

function seatOf(code: string, token: unknown): { room: Room; seat: 0 | 1 } | null {
  const r = rooms.get(code);
  if (!r || typeof token !== "string") return null;
  if (r.seats[0].token === token) return { room: r, seat: 0 };
  if (r.seats[1]?.token === token) return { room: r, seat: 1 };
  return null;
}

function deliver(seat: Seat | null, event: string, data: string) {
  if (!seat) return;
  if (seat.push) seat.push(event, data);
  else {
    seat.queue.push({ event, data });
    if (seat.queue.length > LIMITS.queue) seat.queue.shift();
  }
}

/** Forwards a batch of messages to the other seat. */
export function send(code: string, token: unknown, msgs: unknown): { ok: true } | { error: RoomError } {
  const at = seatOf(code, token);
  if (!at) return { error: "forbidden" };
  if (!Array.isArray(msgs) || msgs.length === 0 || msgs.length > LIMITS.msgsPerPost) return { error: "bad-request" };
  const me = at.room.seats[at.seat]!;
  const now = Date.now();
  if (now - me.window.start > 1000) me.window = { start: now, count: 0 };
  me.window.count += msgs.length;
  if (me.window.count > LIMITS.rate) return { error: "rate" };
  const other = at.room.seats[at.seat === 0 ? 1 : 0];
  for (const m of msgs) {
    const data = JSON.stringify(m);
    if (data.length > LIMITS.msgBytes) return { error: "bad-request" };
    deliver(other, "msg", data);
  }
  at.room.lastActive = now;
  return { ok: true };
}

/** Opens a seat's event stream; returns an unsubscribe function (or an error). */
export function subscribe(code: string, token: unknown, push: Push): { close: () => void; seat: 0 | 1; game: OnlineGame; peer: string | null } | { error: RoomError } {
  const at = seatOf(code, token);
  if (!at) return { error: "forbidden" };
  const me = at.room.seats[at.seat]!;
  const other = at.room.seats[at.seat === 0 ? 1 : 0];
  me.push?.("bye", "{}"); // an older tab of the same seat stops receiving
  me.push = push;
  for (const q of me.queue.splice(0)) push(q.event, q.data);
  deliver(other, "peer", JSON.stringify({ t: "online" }));
  at.room.lastActive = Date.now();
  return {
    seat: at.seat,
    game: at.room.game,
    peer: other?.name ?? null,
    close: () => {
      if (me.push !== push) return;
      me.push = null;
      deliver(other, "peer", JSON.stringify({ t: "offline" }));
    },
  };
}

/** For tests. */
export function _reset() {
  rooms.clear();
}
