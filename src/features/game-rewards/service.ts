import "server-only";
import { randomInt } from "node:crypto";
import { cacheLife, cacheTag } from "next/cache";
import { ACHIEVEMENTS } from "@/atom-world/minigames/achievementList";
import type { MiniGameId } from "@/atom-world/data/machineData";
import type { Prisma } from "@/generated/prisma/client";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import {
  achievementPoints,
  codeState,
  computeRound,
  makeCode,
  normalizeCode,
  parseRules,
  REWARDS_SETTINGS_KEY,
  type RewardRules,
  type RoundInput,
  tehranDayStart,
  usableInStore,
  usableOnline,
} from "./rules";

type Tx = Prisma.TransactionClient;

export const WORLD_LOGIN_URL = `/login?next=${encodeURIComponent("/atom-world")}`;

export class RewardError extends Error {
  constructor(public readonly code: "points" | "limit" | "inactive" | "not-found" | "state" | "channel" | "owner" | "negative") {
    super(code);
  }
}

export async function getRules(): Promise<RewardRules> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.settings);
  const row = await db.siteSetting.findUnique({ where: { key: REWARDS_SETTINGS_KEY } });
  return parseRules(row?.value);
}

/** One account at a time: points are read and written under this row lock. */
async function lockUser(tx: Tx, userId: string) {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
}

export async function balanceOf(tx: Tx | typeof db, userId: string): Promise<number> {
  const r = await tx.gamePointsEntry.aggregate({ where: { userId }, _sum: { amount: true } });
  return r._sum.amount ?? 0;
}

async function countedRoundsToday(tx: Tx | typeof db, userId: string, now: Date) {
  return tx.gamePointsEntry.count({ where: { userId, kind: "ROUND", amount: { gt: 0 }, createdAt: { gte: tehranDayStart(now) } } });
}

/** Everything the 3D world shows in «امتیاز و جایزه». */
export async function rewardsStatus(userId: string | null) {
  const rules = await getRules();
  const base = {
    loginUrl: WORLD_LOGIN_URL,
    enabled: rules.enabled,
    perRound: rules.perRound,
    roundsPerDay: rules.roundsPerDay,
    achievementPoints: Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, achievementPoints(rules, a.id)])),
  };
  if (!userId) return { ...base, loggedIn: false };
  const now = new Date();
  const [balance, roundsToday, cards, mine, unlocks] = await Promise.all([
    balanceOf(db, userId),
    countedRoundsToday(db, userId, now),
    db.rewardCard.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { pointsCost: "asc" }] }),
    db.rewardRedemption.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.gameAchievementUnlock.findMany({ where: { userId }, select: { achievementId: true } }),
  ]);
  return {
    ...base,
    loggedIn: true,
    balance,
    roundsToday,
    cards: cards.map((c) => ({ id: c.id, title: c.title, description: c.description, pointsCost: c.pointsCost, discountPercent: c.discountPercent, channel: c.channel, validDays: c.validDays })),
    mine: mine.map(publicCard),
    achievements: unlocks.map((u) => u.achievementId),
  };
}

function publicCard(r: { code: string; title: string; discountPercent: number; channel: "IN_STORE" | "ONLINE" | "BOTH"; status: "ACTIVE" | "USED" | "CANCELLED"; expiresAt: Date; createdAt: Date }) {
  return { code: r.code, title: r.title, discountPercent: r.discountPercent, channel: r.channel, status: codeState(r), expiresAt: r.expiresAt.toISOString(), createdAt: r.createdAt.toISOString() };
}

/** A finished round: points for the round (capped) and for new achievements (checked here, once each). */
export async function recordRound(userId: string, input: RoundInput, now = new Date()) {
  const rules = await getRules();
  return db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const unlocked = new Set((await tx.gameAchievementUnlock.findMany({ where: { userId }, select: { achievementId: true } })).map((u) => u.achievementId));
    const played = new Set(
      (await tx.gamePointsEntry.findMany({ where: { userId, kind: "ROUND" }, distinct: ["game"], select: { game: true } })).map((r) => r.game).filter((g): g is MiniGameId => !!g),
    );
    const roundsToday = await countedRoundsToday(tx, userId, now);
    const last = await tx.gamePointsEntry.findFirst({ where: { userId, kind: "ROUND", amount: { gt: 0 } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    const out = computeRound(input, { rules, unlocked, played, roundsToday, lastCountedRoundAt: last?.createdAt ?? null, now });
    // a round without points is still kept once per game (it counts for «play every game»)
    if (out.roundPoints > 0 || out.firstOfGame) {
      await tx.gamePointsEntry.create({ data: { userId, kind: "ROUND", amount: out.roundPoints, game: input.game } });
    }
    for (const a of out.achievements) {
      await tx.gameAchievementUnlock.create({ data: { userId, achievementId: a.id, points: a.points } });
      if (a.points > 0) await tx.gamePointsEntry.create({ data: { userId, kind: "ACHIEVEMENT", amount: a.points, game: input.game, achievementId: a.id } });
    }
    return { ...out, balance: await balanceOf(tx, userId) };
  });
}

async function newCode(tx: Tx) {
  for (let i = 0; i < 10; i++) {
    const code = makeCode((max) => randomInt(max));
    if (!(await tx.rewardRedemption.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw new Error("Could not allocate a reward code");
}

/** Spends points on a card and issues its code. */
export async function redeemCard(userId: string, cardId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const card = await tx.rewardCard.findUnique({ where: { id: cardId } });
    if (!card || !card.isActive) throw new RewardError("inactive");
    if ((await balanceOf(tx, userId)) < card.pointsCost) throw new RewardError("points");
    if (card.limitPer30Days > 0) {
      const taken = await tx.rewardRedemption.count({
        where: { userId, cardId, status: { not: "CANCELLED" }, createdAt: { gte: new Date(now.getTime() - 30 * 24 * 3600 * 1000) } },
      });
      if (taken >= card.limitPer30Days) throw new RewardError("limit");
    }
    const r = await tx.rewardRedemption.create({
      data: {
        code: await newCode(tx),
        userId,
        cardId: card.id,
        title: card.title,
        discountPercent: card.discountPercent,
        channel: card.channel,
        pointsSpent: card.pointsCost,
        expiresAt: new Date(now.getTime() + card.validDays * 24 * 3600 * 1000),
      },
    });
    await tx.gamePointsEntry.create({ data: { userId, kind: "REDEEM", amount: -card.pointsCost, redemptionId: r.id, note: card.title } });
    return { card: publicCard(r), balance: await balanceOf(tx, userId) };
  });
}

// ───────────── staff / admin ─────────────

export async function findRedemption(code: string) {
  return db.rewardRedemption.findUnique({
    where: { code: normalizeCode(code) },
    include: { user: { select: { id: true, name: true, phone: true, email: true } }, usedBy: { select: { name: true } }, order: { select: { number: true } } },
  });
}

/** The counter accepts a card (in-store). */
export async function acceptInStore(code: string, staffId: string, now = new Date()) {
  const r = await db.rewardRedemption.findUnique({ where: { code: normalizeCode(code) } });
  if (!r) throw new RewardError("not-found");
  if (codeState(r, now) !== "ACTIVE") throw new RewardError("state");
  if (!usableInStore(r.channel)) throw new RewardError("channel");
  const { count } = await db.rewardRedemption.updateMany({ where: { id: r.id, status: "ACTIVE" }, data: { status: "USED", usedAt: now, usedById: staffId } });
  if (!count) throw new RewardError("state");
  return r;
}

/** Cancels an unused card; with `refund` the points go back to the player. */
export async function cancelRedemption(code: string, actorId: string, refund: boolean) {
  return db.$transaction(async (tx) => {
    const r = await tx.rewardRedemption.findUnique({ where: { code: normalizeCode(code) } });
    if (!r) throw new RewardError("not-found");
    await lockUser(tx, r.userId);
    const { count } = await tx.rewardRedemption.updateMany({ where: { id: r.id, status: "ACTIVE" }, data: { status: "CANCELLED" } });
    if (!count) throw new RewardError("state");
    if (refund && r.pointsSpent > 0) {
      await tx.gamePointsEntry.create({ data: { userId: r.userId, kind: "REFUND", amount: r.pointsSpent, redemptionId: r.id, actorId, note: "لغو کارت توسط مدیر" } });
    }
    return r;
  });
}

/** Manual correction by the manager (never below zero). */
export async function adjustPoints(userId: string, amount: number, note: string, actorId: string) {
  return db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const balance = await balanceOf(tx, userId);
    if (balance + amount < 0) throw new RewardError("negative");
    await tx.gamePointsEntry.create({ data: { userId, kind: "ADJUST", amount, note: note || null, actorId } });
    return balance + amount;
  });
}

// ───────────── online orders ─────────────

/** Locks and checks a card for an online order of this user (inside the order's transaction). */
export async function lockCodeForOrder(tx: Tx, userId: string, code: string, now = new Date()) {
  const normalized = normalizeCode(code);
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM reward_redemptions WHERE code = ${normalized} FOR UPDATE`;
  if (!rows.length) throw new RewardError("not-found");
  const r = await tx.rewardRedemption.findUniqueOrThrow({ where: { id: rows[0].id } });
  if (r.userId !== userId) throw new RewardError("owner");
  if (codeState(r, now) !== "ACTIVE") throw new RewardError("state");
  if (!usableOnline(r.channel)) throw new RewardError("channel");
  return r;
}

export async function attachToOrder(tx: Tx, redemptionId: string, orderId: string, now = new Date()) {
  await tx.rewardRedemption.update({ where: { id: redemptionId }, data: { status: "USED", usedAt: now, orderId } });
}

/** A cancelled online order gives its card back (usable again until it expires). */
export async function releaseForOrderTx(tx: Tx, orderId: string) {
  await tx.rewardRedemption.updateMany({ where: { orderId, status: "USED" }, data: { status: "ACTIVE", usedAt: null, orderId: null } });
}

export const REWARD_ERROR_TEXT: Record<RewardError["code"], string> = {
  points: "امتیاز کافی نیست.",
  limit: "سقف دریافت این کارت پر شده است.",
  inactive: "این کارت فعال نیست.",
  "not-found": "کدی با این مشخصات پیدا نشد.",
  state: "این کارت قابل استفاده نیست (استفاده شده، لغو شده یا منقضی).",
  channel: "این کارت برای این نوع خرید نیست.",
  owner: "این کارت متعلق به حساب شما نیست.",
  negative: "امتیاز کاربر کمتر از صفر می‌شود.",
};
