import { z } from "zod";
import { toEnglishDigits } from "@/lib/format";
import { parseTomanToRial } from "@/lib/text";
import { GRAND_FINAL_MODES, MAX_PARTICIPANTS, TIEBREAKS, TOURNAMENT_FORMATS } from "./constants";
import { parseSetScores } from "./engine";

const optionalText = (max: number) => z.string().trim().max(max, `حداکثر ${max.toLocaleString("fa-IR")} کاراکتر`).default("");
const intField = (min: number, max: number, msg: string) =>
  z.preprocess((v) => (typeof v === "string" ? toEnglishDigits(v).trim() : v), z.coerce.number(msg).int(msg).min(min, msg).max(max, msg));
const optionalInt = (min: number, max: number, msg: string) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : typeof v === "string" ? toEnglishDigits(v).trim() : v), z.coerce.number(msg).int(msg).min(min, msg).max(max, msg).optional());

export const tournamentSchema = z
  .object({
    name: z.string().trim().min(3, "نام تورنومنت را وارد کنید").max(120, "حداکثر ۱۲۰ کاراکتر"),
    game: z.string().trim().min(2, "نام بازی را وارد کنید").max(80, "حداکثر ۸۰ کاراکتر"),
    platform: optionalText(40),
    description: optionalText(3000),
    rules: optionalText(5000),
    prize: optionalText(500),
    entryFeeNote: optionalText(200),
    /** Online registration fee in Toman (empty/0 = free); stored as Rials. */
    entryFeeToman: z
      .string()
      .default("")
      .transform((v, ctx) => {
        const rial = parseTomanToRial(v.trim() || "0");
        if (rial === null || rial < BigInt(0) || rial > BigInt(10_000_000_000)) ctx.addIssue({ code: "custom", message: "مبلغ ثبت‌نام معتبر نیست" });
        return rial ?? BigInt(0);
      }),
    /** ISO string (the browser converts the local date/time) or empty. */
    startsAt: z.string().trim().max(40).default("").refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "تاریخ معتبر نیست"),
    format: z.enum(TOURNAMENT_FORMATS, "نوع تورنومنت را انتخاب کنید"),
    maxParticipants: optionalInt(2, MAX_PARTICIPANTS, `ظرفیت باید بین ۲ و ${MAX_PARTICIPANTS.toLocaleString("fa-IR")} باشد`),
    allowSelfRegistration: z.boolean().default(true),
    /** Check-in opens this many minutes before the start (empty = no check-in). */
    checkInMinutes: optionalInt(5, 1440, "زمان چک‌این باید بین ۵ تا ۱۴۴۰ دقیقه باشد"),
    thirdPlaceMatch: z.boolean().default(false),
    doubleRoundRobin: z.boolean().default(false),
    groupCount: optionalInt(1, 16, "تعداد گروه‌ها باید بین ۱ و ۱۶ باشد"),
    advancePerGroup: optionalInt(1, 8, "تعداد صعودکننده از هر گروه باید بین ۱ و ۸ باشد"),
    /** Double elimination: grand final with reset, single game, or none. */
    grandFinal: z.enum(GRAND_FINAL_MODES).default("reset"),
    /** Round robin / groups: order of tiebreaks after points. */
    tiebreak: z.enum(TIEBREAKS).default("goal_difference"),
    /** Swiss: number of rounds (empty = automatic, log2 of players). */
    swissRounds: optionalInt(1, 20, "تعداد دورها باید بین ۱ و ۲۰ باشد"),
    /** Leaderboard: number of rounds/events at the start (more can be added later). */
    leaderboardRounds: optionalInt(1, 50, "تعداد دورها باید بین ۱ و ۵۰ باشد"),
    pointsWin: intField(0, 10, "امتیاز برد معتبر نیست").default(3),
    pointsDraw: intField(0, 10, "امتیاز مساوی معتبر نیست").default(1),
    pointsLoss: intField(0, 10, "امتیاز باخت معتبر نیست").default(0),
  })
  .superRefine((v, ctx) => {
    if (v.format === "GROUPS_KNOCKOUT") {
      if (!v.groupCount) ctx.addIssue({ code: "custom", path: ["groupCount"], message: "تعداد گروه‌ها را وارد کنید" });
      if (!v.advancePerGroup) ctx.addIssue({ code: "custom", path: ["advancePerGroup"], message: "تعداد صعودکننده از هر گروه را وارد کنید" });
      if (v.groupCount && v.advancePerGroup && v.groupCount * v.advancePerGroup < 2) ctx.addIssue({ code: "custom", path: ["advancePerGroup"], message: "حداقل ۲ نفر باید به مرحلهٔ حذفی صعود کنند" });
    }
    if (v.entryFeeToman > BigInt(0) && !v.allowSelfRegistration) ctx.addIssue({ code: "custom", path: ["entryFeeToman"], message: "هزینهٔ آنلاین فقط وقتی معنا دارد که ثبت‌نام آنلاین باز باشد" });
    if (v.checkInMinutes && !v.startsAt) ctx.addIssue({ code: "custom", path: ["checkInMinutes"], message: "برای چک‌این، زمان شروع را مشخص کنید" });
    if (v.pointsWin < v.pointsDraw) ctx.addIssue({ code: "custom", path: ["pointsWin"], message: "امتیاز برد باید از امتیاز مساوی کمتر نباشد" });
  });

export type TournamentInput = z.input<typeof tournamentSchema>;

export const participantNameSchema = z.string().trim().min(2, "نام حداقل ۲ کاراکتر").max(60, "حداکثر ۶۰ کاراکتر");

const optionalScore = z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : typeof v === "string" ? toEnglishDigits(v).trim() : v), z.coerce.number("امتیاز معتبر نیست").int("امتیاز معتبر نیست").min(0, "امتیاز معتبر نیست").max(999, "امتیاز معتبر نیست").optional());

/**
 * Result of a match. Either a score, game/set scores ("3-1, 2-3" → sets won become the score), or a
 * forfeit win (no score, winner chosen).
 */
export const scoreSchema = z
  .object({
    score1: optionalScore,
    score2: optionalScore,
    winnerSlot: z.union([z.literal(1), z.literal(2)]).optional(),
    note: z.string().trim().max(200).default(""),
    setScores: z.string().trim().max(120).default(""),
    forfeit: z.boolean().default(false),
  })
  .transform((v, ctx) => {
    if (v.forfeit) {
      if (!v.winnerSlot) ctx.addIssue({ code: "custom", path: ["winnerSlot"], message: "برای برد فنی، برنده را انتخاب کنید" });
      return { score1: 0, score2: 0, winnerSlot: v.winnerSlot, note: v.note, setScores: null, forfeit: true };
    }
    if (v.setScores) {
      const sets = parseSetScores(v.setScores);
      if (sets === "invalid" || sets === null) {
        ctx.addIssue({ code: "custom", path: ["setScores"], message: "نتیجهٔ دست‌ها را مثل «3-1, 2-3» بنویسید" });
        return z.NEVER;
      }
      return { score1: sets.won1, score2: sets.won2, winnerSlot: v.winnerSlot, note: v.note, setScores: sets.text, forfeit: false };
    }
    if (v.score1 === undefined) ctx.addIssue({ code: "custom", path: ["score1"], message: "امتیاز را وارد کنید" });
    if (v.score2 === undefined) ctx.addIssue({ code: "custom", path: ["score2"], message: "امتیاز را وارد کنید" });
    return { score1: v.score1 ?? 0, score2: v.score2 ?? 0, winnerSlot: v.winnerSlot, note: v.note, setScores: null, forfeit: false };
  });

export const matchDetailsSchema = z.object({
  station: z.string().trim().max(40, "حداکثر ۴۰ کاراکتر").default(""),
  /** ISO string (the browser converts Tehran local time) or empty. */
  scheduledAt: z.string().trim().max(40).default("").refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "زمان معتبر نیست"),
});
