"use client";

import type { MiniGameId } from "../data/machineData";
import { createStore } from "../store";
import type { Stats } from "./achievementList";

/**
 * Points and reward cards of the club (served by the main site, `src/features/game-rewards` there).
 * Points live on the player's site account: earned for finished rounds (capped per day) and once per
 * achievement; spent on discount cards the manager defines (cost, percent, in-store / online shop).
 * Without the site (this repo alone, the stand-alone preview) the route is missing → everything here
 * stays off and the world works as before.
 */
export const REWARDS_API = "/api/game-rewards";

export type CardChannel = "IN_STORE" | "ONLINE" | "BOTH";

export interface RewardCard {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  discountPercent: number;
  channel: CardChannel;
  validDays: number;
}

export interface MyCard {
  code: string;
  title: string;
  discountPercent: number;
  channel: CardChannel;
  status: "ACTIVE" | "USED" | "EXPIRED" | "CANCELLED";
  expiresAt: string;
  createdAt: string;
}

export interface RewardsState {
  /** The site answers (false: no site, or offline). */
  available: boolean;
  loading: boolean;
  loggedIn: boolean;
  loginUrl: string;
  enabled: boolean;
  balance: number;
  perRound: number;
  roundsPerDay: number;
  roundsToday: number;
  cards: RewardCard[];
  mine: MyCard[];
  /** achievement ids earned on the account */
  achievements: string[];
  /** points per achievement as set by the manager (missing = the default in achievementList) */
  achievementPoints: Record<string, number>;
}

export const rewardsStore = createStore<RewardsState>({
  available: false,
  loading: false,
  loggedIn: false,
  loginUrl: "/login?next=%2Fatom-world",
  enabled: false,
  balance: 0,
  perRound: 0,
  roundsPerDay: 0,
  roundsToday: 0,
  cards: [],
  mine: [],
  achievements: [],
  achievementPoints: {},
});

const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");
const CHANNELS: CardChannel[] = ["IN_STORE", "ONLINE", "BOTH"];
const channel = (v: unknown): CardChannel => (CHANNELS.includes(v as CardChannel) ? (v as CardChannel) : "IN_STORE");
const STATUSES = ["ACTIVE", "USED", "EXPIRED", "CANCELLED"] as const;

/** Reads the site's answer defensively (it is shown to the player). */
export function parseStatus(j: unknown): Partial<RewardsState> {
  const o = (j && typeof j === "object" ? j : {}) as Record<string, unknown>;
  const cards = Array.isArray(o.cards) ? o.cards : [];
  const mine = Array.isArray(o.mine) ? o.mine : [];
  const ap = o.achievementPoints && typeof o.achievementPoints === "object" ? (o.achievementPoints as Record<string, unknown>) : {};
  const login = str(o.loginUrl, 200);
  return {
    available: true,
    loggedIn: o.loggedIn === true,
    // only a page of this site may be offered as the login
    loginUrl: /^\/(?!\/)/.test(login) ? login : "/login?next=%2Fatom-world",
    enabled: o.enabled === true,
    balance: Math.max(0, Math.floor(num(o.balance))),
    perRound: num(o.perRound),
    roundsPerDay: num(o.roundsPerDay),
    roundsToday: num(o.roundsToday),
    cards: cards.slice(0, 50).map((c: Record<string, unknown>) => ({
      id: str(c.id, 40),
      title: str(c.title, 80),
      description: str(c.description, 300),
      pointsCost: Math.max(0, Math.floor(num(c.pointsCost))),
      discountPercent: Math.min(100, Math.max(0, Math.floor(num(c.discountPercent)))),
      channel: channel(c.channel),
      validDays: Math.max(0, Math.floor(num(c.validDays))),
    })),
    mine: mine.slice(0, 50).map((c: Record<string, unknown>) => ({
      code: str(c.code, 40),
      title: str(c.title, 80),
      discountPercent: Math.min(100, Math.max(0, Math.floor(num(c.discountPercent)))),
      channel: channel(c.channel),
      status: (STATUSES as readonly string[]).includes(c.status as string) ? (c.status as MyCard["status"]) : "EXPIRED",
      expiresAt: str(c.expiresAt, 40),
      createdAt: str(c.createdAt, 40),
    })),
    achievements: Array.isArray(o.achievements) ? o.achievements.filter((a): a is string => typeof a === "string").slice(0, 200) : [],
    achievementPoints: Object.fromEntries(Object.entries(ap).filter(([, v]) => typeof v === "number")) as Record<string, number>,
  };
}

async function call(path: string, init?: RequestInit) {
  return fetch(`${REWARDS_API}${path}`, { cache: "no-store", credentials: "same-origin", ...init, headers: { accept: "application/json", ...(init?.headers ?? {}) } });
}

/** Asks the site for the player's points, cards and the manager's rules. */
export async function loadRewards() {
  rewardsStore.set({ loading: true });
  try {
    const res = await call("");
    if (!res.ok) {
      rewardsStore.set({ available: false, loading: false });
      return;
    }
    rewardsStore.set({ ...parseStatus(await res.json()), loading: false });
  } catch {
    rewardsStore.set({ available: false, loading: false });
  }
}

export interface RoundReward {
  /** points for the round itself (0 when today's cap is reached) */
  roundPoints: number;
  /** achievements unlocked on the account with this round, with their points */
  achievements: { id: string; points: number }[];
  balance: number;
  capReached: boolean;
}

/** After a finished round: the site checks the stats itself and adds the points. */
export async function reportRound(game: MiniGameId, stats: Stats, seconds: number): Promise<RoundReward | null> {
  const s = rewardsStore.get();
  if (!s.available || !s.loggedIn || !s.enabled) return null;
  try {
    const res = await call("/round", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ game, stats, seconds: Math.round(seconds) }) });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    const achievements = Array.isArray(j.achievements)
      ? j.achievements.filter((a): a is { id: string; points: number } => !!a && typeof (a as { id?: unknown }).id === "string").map((a) => ({ id: a.id, points: num(a.points) }))
      : [];
    const r: RoundReward = { roundPoints: num(j.roundPoints), achievements, balance: num(j.balance, s.balance), capReached: j.capReached === true };
    rewardsStore.set({
      balance: r.balance,
      roundsToday: s.roundsToday + (r.roundPoints > 0 ? 1 : 0),
      achievements: [...new Set([...s.achievements, ...achievements.map((a) => a.id)])],
    });
    return r;
  } catch {
    return null;
  }
}

export type RedeemError = "points" | "limit" | "inactive" | "login" | "error";

/** Spends points on a card; the site returns the new card (its code is shown to the player). */
export async function redeem(cardId: string): Promise<{ card: MyCard } | { error: RedeemError }> {
  try {
    const res = await call("/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cardId }) });
    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const e = j.error;
      return { error: e === "points" || e === "limit" || e === "inactive" || e === "login" ? e : "error" };
    }
    const parsed = parseStatus({ mine: [j.card] }).mine?.[0];
    if (!parsed) return { error: "error" };
    const s = rewardsStore.get();
    rewardsStore.set({ balance: num(j.balance, s.balance), mine: [parsed, ...s.mine] });
    return { card: parsed };
  } catch {
    return { error: "error" };
  }
}

export const CHANNEL_LABEL: Record<CardChannel, string> = {
  IN_STORE: "حضوری در گیم‌نت اتم",
  ONLINE: "فروشگاه آنلاین سایت",
  BOTH: "حضوری یا فروشگاه آنلاین",
};

export const CHANNEL_HOWTO: Record<CardChannel, string> = {
  IN_STORE: "کد را در گیم‌نت به پیشخوان نشان دهید.",
  ONLINE: "کد را هنگام پرداخت سفارش در فروشگاه سایت وارد کنید.",
  BOTH: "کد را در گیم‌نت به پیشخوان نشان دهید، یا هنگام پرداخت سفارش در فروشگاه سایت وارد کنید.",
};
