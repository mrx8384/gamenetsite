import { z } from "zod";
import { ACHIEVEMENTS, PLAYABLE_GAMES, type Stats } from "@/atom-world/minigames/achievementList";
import type { MiniGameId } from "@/atom-world/data/machineData";

/**
 * Points and reward cards of the 3D world (pure: no database, unit-tested).
 * - A finished round gives `perRound` points, at most `roundsPerDay` counted rounds per Tehran day,
 *   and only if `minSecondsBetweenRounds` passed since the last counted one.
 * - Each achievement gives its points once per account. The server re-checks the achievement test
 *   against the round's stats (the same pure tests the game uses), so a browser cannot just claim it.
 * - A round counts only if the server saw it start (a one-time round token, `/api/game-rewards/start`),
 *   it lasted at least `MIN_ROUND_SECONDS` of real time, and its numbers are possible in that time
 *   (`plausibleRound`). This stops "I won" being posted without playing.
 * - Visitors without an account earn nothing; the world lets them play each game `guestRoundsPerGame` times.
 * Mini-games run in the browser, so a determined cheater can still fake rounds: the caps above bound
 * what anyone can earn per day, and the manager sets card costs with that in mind (docs/GAME_REWARDS.md).
 */
export const REWARDS_SETTINGS_KEY = "game-rewards";

export const rewardRulesSchema = z.object({
  enabled: z.boolean().default(true),
  perRound: z.coerce.number().int().min(0).max(100).default(5),
  roundsPerDay: z.coerce.number().int().min(0).max(200).default(20),
  minSecondsBetweenRounds: z.coerce.number().int().min(0).max(600).default(30),
  /** Visitors without an account may play each mini-game this many times (0 = no limit). */
  guestRoundsPerGame: z.coerce.number().int().min(0).max(50).default(1),
  /** Points per achievement set by the manager; missing = the default from the achievement list. */
  achievementPoints: z.record(z.string().max(60), z.coerce.number().int().min(0).max(10000)).default({}),
});
export type RewardRules = z.infer<typeof rewardRulesSchema>;

export const DEFAULT_RULES: RewardRules = rewardRulesSchema.parse({});

export function parseRules(value: unknown): RewardRules {
  const r = rewardRulesSchema.safeParse(value ?? {});
  if (!r.success) return DEFAULT_RULES;
  // only real achievements (old ids are dropped)
  const known = new Set(ACHIEVEMENTS.map((a) => a.id));
  return { ...r.data, achievementPoints: Object.fromEntries(Object.entries(r.data.achievementPoints).filter(([id]) => known.has(id))) };
}

export function achievementPoints(rules: RewardRules, id: string): number {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  return rules.achievementPoints[id] ?? a?.points ?? 0;
}

/** A round shorter than this (real time, measured by the server) is not counted. */
export const MIN_ROUND_SECONDS: Record<string, number> = {
  "air-hockey": 15,
  "construction-excavator": 30,
  "foot-pool": 10,
  "gc-controller": 5,
  "gc-city": 15,
  "gc-football": 30,
  "face-paint": 6,
};
/** Rounds older than this cannot be reported any more. */
export const MAX_ROUND_SECONDS = 3 * 3600;

const v = (s: Stats, k: string) => (typeof s[k] === "number" && Number.isFinite(s[k]) ? (s[k] as number) : 0);

/**
 * Can these numbers come out of a real round that lasted `elapsed` seconds? Generous limits: they only
 * stop impossible claims (e.g. a won match after a few seconds, 30 trucks in a minute).
 */
export function plausibleRound(game: MiniGameId, stats: Stats, elapsed: number): boolean {
  if (elapsed < (MIN_ROUND_SECONDS[game] ?? 5)) return false;
  for (const x of Object.values(stats)) if (typeof x === "number" && x < 0) return false;
  if (v(stats, "seconds") > elapsed + 5) return false;
  switch (game) {
    case "air-hockey":
      return v(stats, "goals") <= 7 && v(stats, "against") <= 7 && (stats.won !== true || v(stats, "goals") >= 1);
    case "construction-excavator":
      return v(stats, "trucks") <= 1 + elapsed / 6;
    case "foot-pool":
      return v(stats, "kicks") <= 5 + elapsed && (stats.cleared !== true || v(stats, "kicks") >= 1);
    case "gc-controller":
      return v(stats, "hits") <= elapsed * 4 && v(stats, "bestCombo") <= v(stats, "hits") && v(stats, "score") <= v(stats, "hits") * 100;
    case "gc-city":
      return v(stats, "deliveries") <= 1 + elapsed / 8 && v(stats, "money") <= 200 + v(stats, "deliveries") * 250 + elapsed * 5;
    case "gc-football":
      return v(stats, "goalsFor") <= 1 + elapsed / 5 && v(stats, "goalsAgainst") <= 1 + elapsed / 5;
    case "face-paint": {
      const faces = v(stats, "faces");
      const [best, worst, avg] = [v(stats, "best"), v(stats, "worst"), v(stats, "avg")];
      return faces <= 3 && best <= 100 && worst <= avg && avg <= best && elapsed >= faces * 3;
    }
    default:
      return true;
  }
}

/** What a browser may send for a finished round. */
export const roundInputSchema = z.object({
  /** from POST /api/game-rewards/start when the round began */
  token: z.string().max(200).default(""),
  game: z.enum(PLAYABLE_GAMES as [MiniGameId, ...MiniGameId[]]),
  stats: z
    .record(z.string().max(40), z.union([z.number().finite().min(-1e7).max(1e7), z.boolean()]))
    .refine((s) => Object.keys(s).length <= 20, "too many stats"),
  seconds: z.coerce.number().min(0).max(24 * 3600).default(0),
});
export type RoundInput = z.infer<typeof roundInputSchema>;

// Iran has had no daylight saving time since 2022: Tehran is always UTC+3:30.
const TEHRAN_OFFSET_MS = 3.5 * 3600 * 1000;
const DAY = 24 * 3600 * 1000;
export function tehranDayStart(now: Date): Date {
  return new Date(Math.floor((now.getTime() + TEHRAN_OFFSET_MS) / DAY) * DAY - TEHRAN_OFFSET_MS);
}

export interface RoundContext {
  rules: RewardRules;
  /** achievement ids the account already has */
  unlocked: Set<string>;
  /** games played on the account before this round */
  played: Set<MiniGameId>;
  /** counted (point-giving) rounds today */
  roundsToday: number;
  lastCountedRoundAt: Date | null;
  now: Date;
}

export interface RoundOutcome {
  roundPoints: number;
  achievements: { id: string; points: number }[];
  /** true when the daily round cap stopped the round points */
  capReached: boolean;
  /** the round is the first of this game on the account (recorded even without points) */
  firstOfGame: boolean;
}

export function computeRound(input: RoundInput, ctx: RoundContext): RoundOutcome {
  const { rules } = ctx;
  if (!rules.enabled) return { roundPoints: 0, achievements: [], capReached: false, firstOfGame: false };
  const capReached = ctx.roundsToday >= rules.roundsPerDay;
  const tooSoon = ctx.lastCountedRoundAt !== null && ctx.now.getTime() - ctx.lastCountedRoundAt.getTime() < rules.minSecondsBetweenRounds * 1000;
  const roundPoints = capReached || tooSoon ? 0 : rules.perRound;
  const played = new Set(ctx.played);
  played.add(input.game);
  const stats = input.stats as Stats;
  const achievements = ACHIEVEMENTS.filter((a) => !ctx.unlocked.has(a.id) && (a.game === null || a.game === input.game) && a.test(input.game, stats, played)).map((a) => ({
    id: a.id,
    points: achievementPoints(rules, a.id),
  }));
  return { roundPoints, achievements, capReached, firstOfGame: !ctx.played.has(input.game) };
}

export const CHANNEL_LABEL = { IN_STORE: "حضوری در گیم‌نت", ONLINE: "فروشگاه آنلاین", BOTH: "حضوری و آنلاین" } as const;
export type Channel = keyof typeof CHANNEL_LABEL;
export const usableInStore = (c: Channel) => c === "IN_STORE" || c === "BOTH";
export const usableOnline = (c: Channel) => c === "ONLINE" || c === "BOTH";

export const MAX_ONLINE_PERCENT = 90;

export const rewardCardSchema = z
  .object({
  title: z.string().trim().min(2, "عنوان کارت را وارد کنید").max(80),
  description: z.string().trim().max(300).default(""),
  pointsCost: z.coerce.number().int().min(1, "دست‌کم ۱ امتیاز").max(1_000_000),
  discountPercent: z.coerce.number().int().min(1, "بین ۱ تا ۱۰۰ درصد").max(100, "بین ۱ تا ۱۰۰ درصد"),
  channel: z.enum(["IN_STORE", "ONLINE", "BOTH"]),
  validDays: z.coerce.number().int().min(1, "دست‌کم ۱ روز").max(365),
  limitPer30Days: z.coerce.number().int().min(0).max(100).default(1),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  })
  .superRefine((v, ctx) => {
    // the payment gateway needs an amount above zero
    if (v.channel !== "IN_STORE" && v.discountPercent > MAX_ONLINE_PERCENT) {
      ctx.addIssue({ code: "custom", path: ["discountPercent"], message: `برای فروشگاه آنلاین حداکثر ${MAX_ONLINE_PERCENT.toLocaleString("fa-IR")}٪` });
    }
  });

/** Card codes: ATOM-XXXX-XXXX from letters/digits that are hard to confuse (no 0/O, 1/I/L). */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function makeCode(random: (max: number) => number): string {
  const part = () => Array.from({ length: 4 }, () => ALPHABET[random(ALPHABET.length)]).join("");
  return `ATOM-${part()}-${part()}`;
}

/** What people type at the counter or at checkout: Persian digits, spaces, lower case… */
export function normalizeCode(input: string): string {
  const latin = input.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const raw = latin.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = raw.startsWith("ATOM") ? raw.slice(4) : raw;
  return body.length === 8 ? `ATOM-${body.slice(0, 4)}-${body.slice(4)}` : latin.trim().toUpperCase();
}

export type CodeState = "ACTIVE" | "USED" | "EXPIRED" | "CANCELLED";
export function codeState(r: { status: "ACTIVE" | "USED" | "CANCELLED"; expiresAt: Date }, now = new Date()): CodeState {
  return r.status === "ACTIVE" && r.expiresAt.getTime() < now.getTime() ? "EXPIRED" : r.status;
}

/** Discount of an online order: percent of the products (not shipping), whole Toman (10 Rial). */
export function orderDiscount(subtotal: bigint, percent: number): bigint {
  const p = BigInt(Math.max(0, Math.min(MAX_ONLINE_PERCENT, Math.floor(percent))));
  const rial = (subtotal * p) / BigInt(100);
  return (rial / BigInt(10)) * BigInt(10);
}

/** Game names for the admin pages (kept here: the world's registry loads the games themselves). */
export const GAME_NAMES: Record<string, string> = {
  "air-hockey": "🏒 ایرهاکی",
  "construction-excavator": "🚜 بیل مکانیکی RC",
  "foot-pool": "⚽ فوت‌پول",
  "gc-controller": "🎮 چالش دستهٔ گیم‌نت",
  "gc-city": "🏙️ شهر اتم",
  "gc-football": "⚽ فوتبال اتم",
  "face-paint": "🎨 گریم صورت",
};
