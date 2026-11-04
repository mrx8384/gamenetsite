import { z } from "zod";
import { toEnglishDigits } from "@/lib/format";
import { parseTomanToRial } from "@/lib/text";
import { MAX_PARTICIPANTS, TOURNAMENT_FORMATS } from "./constants";

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
    thirdPlaceMatch: z.boolean().default(false),
    doubleRoundRobin: z.boolean().default(false),
    groupCount: optionalInt(1, 16, "تعداد گروه‌ها باید بین ۱ و ۱۶ باشد"),
    advancePerGroup: optionalInt(1, 8, "تعداد صعودکننده از هر گروه باید بین ۱ و ۸ باشد"),
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
    if (v.pointsWin < v.pointsDraw) ctx.addIssue({ code: "custom", path: ["pointsWin"], message: "امتیاز برد باید از امتیاز مساوی کمتر نباشد" });
  });

export type TournamentInput = z.input<typeof tournamentSchema>;

export const participantNameSchema = z.string().trim().min(2, "نام حداقل ۲ کاراکتر").max(60, "حداکثر ۶۰ کاراکتر");

export const scoreSchema = z.object({
  score1: intField(0, 99, "امتیاز معتبر نیست"),
  score2: intField(0, 99, "امتیاز معتبر نیست"),
  winnerSlot: z.union([z.literal(1), z.literal(2)]).optional(),
  note: z.string().trim().max(200).default(""),
});
