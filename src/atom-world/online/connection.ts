"use client";

import { createStore } from "../store";

/**
 * Connection to a friend's phone through the site's room relay (src/atom-world/server/rooms.ts).
 * Down: Server-Sent Events. Up: small POST batches (every 50 ms at most).
 * Off in the stand-alone preview (no server there).
 */
export type OnlineGame = "air-hockey" | "foot-pool";
export const ONLINE_ENABLED = process.env.NEXT_PUBLIC_ATOM_ONLINE !== "0";
const API = "/api/atom-world/rooms";

export type LinkStatus = "connecting" | "waiting" | "ready" | "peer-offline" | "closed" | "error";

export interface LinkState {
  status: LinkStatus;
  code: string;
  seat: 0 | 1;
  game: OnlineGame;
  myName: string;
  peerName: string | null;
  error: string | null;
}

export type Message = Record<string, unknown> & { t: string };

export class RoomLink {
  readonly state = createStore<LinkState>({ status: "connecting", code: "", seat: 0, game: "foot-pool", myName: "", peerName: null, error: null });
  private token = "";
  private es: EventSource | null = null;
  private out: Message[] = [];
  private timer: number | null = null;
  private listeners = new Set<(m: Message) => void>();

  /** Creates a new room (you are seat 0, the host). */
  static async create(game: OnlineGame, name: string) {
    const link = new RoomLink();
    const r = await post(API, { game, name });
    if (!r.ok) throw new Error(r.error);
    link.token = r.data.token as string;
    link.state.set({ code: r.data.code as string, seat: 0, game, myName: name, status: "waiting" });
    link.open();
    return link;
  }

  /** Joins a friend's room by its 5-digit code (you are seat 1). */
  static async join(code: string, name: string) {
    const link = new RoomLink();
    const r = await post(`${API}/${code}/join`, { name });
    if (!r.ok) throw new Error(r.error);
    link.token = r.data.token as string;
    link.state.set({ code, seat: 1, game: r.data.game as OnlineGame, myName: name, peerName: r.data.hostName as string, status: "ready" });
    link.open();
    return link;
  }

  private open() {
    const { code } = this.state.get();
    const es = new EventSource(`${API}/${code}/events?token=${encodeURIComponent(this.token)}`);
    this.es = es;
    es.addEventListener("hello", (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      if (d.peer) this.state.set({ peerName: d.peer, status: "ready" });
    });
    es.addEventListener("peer", (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      if (d.t === "joined") this.state.set({ peerName: d.name, status: "ready" });
      if (d.t === "online" && this.state.get().peerName) this.state.set({ status: "ready" });
      if (d.t === "offline") this.state.set({ status: "peer-offline" });
    });
    es.addEventListener("msg", (e) => {
      const m = JSON.parse((e as MessageEvent).data) as Message;
      this.listeners.forEach((l) => l(m));
    });
    es.addEventListener("fail", () => {
      this.state.set({ status: "error", error: "اتاق پیدا نشد یا منقضی شده است." });
      es.close();
    });
    es.addEventListener("bye", () => es.close());
    es.onerror = () => {
      // EventSource reconnects by itself; show it only if it stays down
      if (es.readyState === EventSource.CLOSED && this.state.get().status !== "closed") this.state.set({ status: "error", error: "ارتباط با سرور قطع شد." });
    };
  }

  on(fn: (m: Message) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** Queues a message; batches go out every 50 ms. `latest` replaces an earlier queued message of the same type (positions). */
  send(m: Message, latest = false) {
    if (latest) {
      const i = this.out.findIndex((o) => o.t === m.t);
      if (i >= 0) this.out.splice(i, 1);
    }
    this.out.push(m);
    if (this.timer === null) this.timer = window.setTimeout(() => this.flush(), 50);
  }

  private async flush() {
    this.timer = null;
    const msgs = this.out.splice(0, 30);
    if (!msgs.length) return;
    const { code } = this.state.get();
    const r = await post(`${API}/${code}/send`, { token: this.token, msgs });
    if (!r.ok && r.error === "forbidden") this.state.set({ status: "error", error: "این اتاق دیگر در دسترس نیست." });
    if (this.out.length && this.timer === null) this.timer = window.setTimeout(() => this.flush(), 50);
  }

  close() {
    this.state.set({ status: "closed" });
    this.es?.close();
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.listeners.clear();
  }
}

async function post(url: string, body: unknown): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return res.ok ? { ok: true, data } : { ok: false, error: String(data.error ?? res.status) };
  } catch {
    return { ok: false, error: "network" };
  }
}

/** Is the room server reachable from here? */
export async function onlineAvailable() {
  if (!ONLINE_ENABLED) return false;
  try {
    const r = await fetch(API, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!r.ok) return false;
    return ((await r.json()) as { online?: boolean }).online === true;
  } catch {
    return false;
  }
}

export const ERROR_TEXT: Record<string, string> = {
  "not-found": "اتاقی با این کد پیدا نشد. کد را دوباره بررسی کنید.",
  full: "این اتاق پر است (دو نفر داخلش هستند).",
  busy: "سرور شلوغ است؛ کمی بعد دوباره امتحان کنید.",
  network: "اتصال اینترنت برقرار نیست.",
  rate: "تلاش‌ها زیاد بود؛ یک دقیقه بعد دوباره امتحان کنید.",
};
