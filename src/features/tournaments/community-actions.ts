"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertUser, AuthorizationError } from "@/lib/auth/dal";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { fail, isUniqueViolation, ok, RATE_LIMIT_ERROR, type ActionResult } from "@/lib/action-result";
import { parseIdentifier } from "@/lib/identifiers";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestInfo } from "@/lib/request-info";
import { MAX_CO_ORGANIZERS } from "./constants";
import { manageableTournament } from "./permissions";
import { predictionSummary, predictorName } from "./predictions";
import { claimSchema, participantNameSchema } from "./schemas";
import * as service from "./service";

/**
 * Tournament phase 3 actions: co-organizers, team edits, player result reports, predictions and the
 * waiting list. Organizer rights only via permissions.ts; players never set a result on their own —
 * their report needs the opponent's or an organizer's confirmation.
 */

const DENIED = "دسترسی غیرمجاز.";

async function actor() {
  try {
    return (await assertUser()).user;
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

function changed(userId: string, action: string, entityId: string, meta?: Record<string, unknown>) {
  updateTag(CACHE_TAGS.tournaments);
  void getRequestInfo().then(({ ip }) => audit({ actorId: userId, action: `tournaments.${action}`, entity: "tournament", entityId, ip, meta: meta as never }));
}

async function guard(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    if (e instanceof service.TournamentError) return e.message;
    throw e;
  }
}

// ───────────── Co-organizers (owner only) ─────────────

export async function addCoOrganizer(tournamentId: unknown, contact: unknown): Promise<ActionResult<undefined>> {
  const user = await actor();
  const t = user && typeof tournamentId === "string" ? await manageableTournament(user, tournamentId, "owner") : null;
  if (!user || !t) return fail(DENIED);
  const id = typeof contact === "string" ? parseIdentifier(contact) : null;
  if (!id) return fail("ایمیل یا شمارهٔ موبایل معتبر وارد کنید.", { contact: "ایمیل یا شمارهٔ موبایل معتبر نیست." });
  const target = await db.user.findFirst({ where: id.kind === "email" ? { email: id.value } : { phone: id.value }, select: { id: true, name: true, isActive: true } });
  // Same message whether or not the account exists elsewhere: only real, active accounts can be added.
  if (!target || !target.isActive) return fail("حساب کاربری فعالی با این مشخصات پیدا نشد. ابتدا آن شخص باید در سایت ثبت‌نام کند.", { contact: "حسابی پیدا نشد." });
  if (target.id === t.organizerId) return fail("این شخص خودش برگزارکنندهٔ تورنومنت است.");
  if ((await db.tournamentCoOrganizer.count({ where: { tournamentId: t.id } })) >= MAX_CO_ORGANIZERS) return fail(`حداکثر ${MAX_CO_ORGANIZERS.toLocaleString("fa-IR")} همکار برگزاری.`);
  try {
    await db.tournamentCoOrganizer.create({ data: { tournamentId: t.id, userId: target.id } });
  } catch (e) {
    if (isUniqueViolation(e)) return fail("این شخص قبلاً اضافه شده است.");
    throw e;
  }
  changed(user.id, "co_organizer_added", t.id, { userId: target.id });
  return ok(undefined, `«${target.name}» به برگزارکنندگان اضافه شد.`);
}

export async function removeCoOrganizer(tournamentId: unknown, userId: unknown): Promise<ActionResult<undefined>> {
  const user = await actor();
  const t = user && typeof tournamentId === "string" ? await manageableTournament(user, tournamentId, "owner") : null;
  if (!user || !t || typeof userId !== "string") return fail(DENIED);
  await db.tournamentCoOrganizer.deleteMany({ where: { tournamentId: t.id, userId } });
  changed(user.id, "co_organizer_removed", t.id, { userId });
  return ok(undefined, "از برگزارکنندگان حذف شد.");
}

// ───────────── Participants: name and team members ─────────────

const participantEditSchema = z.object({
  name: participantNameSchema,
  members: z.array(z.string().trim().min(2, "نام هر عضو حداقل ۲ کاراکتر").max(60, "حداکثر ۶۰ کاراکتر")).max(9, "حداکثر ۹ عضو").default([]),
});

export async function updateParticipant(participantId: unknown, input: unknown): Promise<ActionResult<undefined>> {
  const user = await actor();
  const p = typeof participantId === "string" ? await db.tournamentParticipant.findUnique({ where: { id: participantId }, select: { id: true, tournamentId: true } }) : null;
  if (!user || !p || !(await manageableTournament(user, p.tournamentId))) return fail(DENIED);
  const parsed = participantEditSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "اطلاعات نامعتبر است.");
  try {
    await db.tournamentParticipant.update({ where: { id: p.id }, data: { name: parsed.data.name, members: parsed.data.members.filter(Boolean) } });
  } catch (e) {
    if (isUniqueViolation(e)) return fail("این نام قبلاً در تورنومنت ثبت شده است.");
    throw e;
  }
  changed(user.id, "participant_edited", p.tournamentId, { participantId: p.id });
  return ok(undefined, "ذخیره شد.");
}

// ───────────── Player result reports ─────────────

export async function claimMatchResult(matchId: unknown, input: unknown): Promise<ActionResult<undefined>> {
  const user = await actor();
  if (!user) return fail("ابتدا وارد حساب کاربری شوید.");
  if (typeof matchId !== "string") return fail(DENIED);
  if (!(await rateLimit(`tournament-claim:${user.id}`, 30, 60 * 60)).allowed) return fail(RATE_LIMIT_ERROR);
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "نتیجه نامعتبر است.");
  const res: { outcome: "applied" | "pending" } = { outcome: "pending" };
  const err = await guard(async () => (res.outcome = await service.claimResult(matchId, user.id, parsed.data)));
  const outcome = res.outcome;
  if (err) return fail(err);
  const m = await db.tournamentMatch.findUnique({ where: { id: matchId }, select: { tournamentId: true } });
  if (m) changed(user.id, outcome === "applied" ? "claim_matched" : "claim_reported", m.tournamentId, { matchId });
  return ok(undefined, outcome === "applied" ? "نتیجهٔ شما با گزارش حریف یکی بود و ثبت شد." : "نتیجه ثبت شد و منتظر تأیید حریف یا برگزارکننده است.");
}

/** The opponent confirms the reported result; organizers confirm through the same action. */
export async function confirmMatchClaim(matchId: unknown): Promise<ActionResult<undefined>> {
  const user = await actor();
  if (!user || typeof matchId !== "string") return fail(DENIED);
  const m = await db.tournamentMatch.findUnique({ where: { id: matchId }, select: { tournamentId: true } });
  if (!m) return fail(DENIED);
  const organizer = !!(await manageableTournament(user, m.tournamentId));
  const err = await guard(() => service.confirmClaim(matchId, organizer ? null : user.id));
  if (err) return fail(err);
  changed(user.id, "claim_confirmed", m.tournamentId, { matchId, by: organizer ? "organizer" : "opponent" });
  return ok(undefined, "نتیجه تأیید و ثبت شد.");
}

export async function rejectMatchClaim(matchId: unknown): Promise<ActionResult<undefined>> {
  const user = await actor();
  if (!user || typeof matchId !== "string") return fail(DENIED);
  const m = await db.tournamentMatch.findUnique({ where: { id: matchId }, select: { tournamentId: true } });
  if (!m || !(await manageableTournament(user, m.tournamentId))) return fail(DENIED);
  await service.rejectClaim(matchId);
  changed(user.id, "claim_rejected", m.tournamentId, { matchId });
  return ok(undefined, "گزارش بازیکن رد شد.");
}

// ───────────── Predictions ─────────────

export async function predictMatch(matchId: unknown, participantId: unknown): Promise<ActionResult<undefined>> {
  const user = await actor();
  if (!user) return fail("برای پیش‌بینی وارد حساب کاربری شوید.");
  if (typeof matchId !== "string" || typeof participantId !== "string") return fail(DENIED);
  if (!(await rateLimit(`tournament-predict:${user.id}`, 300, 60 * 60)).allowed) return fail(RATE_LIMIT_ERROR);
  const err = await guard(() => service.predict(matchId, user.id, participantId));
  if (err) return fail(err);
  return ok(undefined, "پیش‌بینی شما ثبت شد.");
}

export interface PredictionBoard {
  enabled: boolean;
  loggedIn: boolean;
  /** matchId → predicted participantId (current user). */
  mine: Record<string, string>;
  /** matchId → participantId → count. */
  counts: Record<string, Record<string, number>>;
  top: { name: string; correct: number; decided: number; me: boolean }[];
  myScore: { correct: number; decided: number } | null;
}

/** Per-visitor prediction data for the public page (not cached: depends on the user). */
export async function getPredictionBoard(tournamentId: unknown): Promise<PredictionBoard | null> {
  if (typeof tournamentId !== "string") return null;
  const t = await db.tournament.findUnique({ where: { id: tournamentId }, select: { allowPredictions: true, status: true } });
  if (!t || !t.allowPredictions || (t.status !== "IN_PROGRESS" && t.status !== "COMPLETED")) return null;
  const user = await actor();
  const [matches, preds] = await Promise.all([
    db.tournamentMatch.findMany({ where: { tournamentId }, select: { id: true, player1Id: true, player2Id: true, status: true, winnerId: true, forfeit: true } }),
    db.tournamentPrediction.findMany({ where: { tournamentId }, select: { matchId: true, userId: true, participantId: true } }),
  ]);
  const { counts, ranking } = predictionSummary(matches, preds);
  const topIds = ranking.slice(0, 10).map((r) => r.userId);
  const names = new Map((await db.user.findMany({ where: { id: { in: topIds } }, select: { id: true, name: true } })).map((u) => [u.id, predictorName(u.name)]));
  const mine: Record<string, string> = {};
  if (user) for (const p of preds) if (p.userId === user.id) mine[p.matchId] = p.participantId;
  const myRow = user ? ranking.find((r) => r.userId === user.id) : undefined;
  return {
    enabled: true,
    loggedIn: !!user,
    mine,
    counts,
    top: ranking.slice(0, 10).map((r) => ({ name: names.get(r.userId) ?? "کاربر", correct: r.correct, decided: r.decided, me: r.userId === user?.id })),
    myScore: myRow ? { correct: myRow.correct, decided: myRow.decided } : null,
  };
}

// ───────────── Waiting list ─────────────

export async function leaveWaitlist(tournamentId: unknown): Promise<ActionResult<undefined>> {
  const user = await actor();
  if (!user || typeof tournamentId !== "string") return fail(DENIED);
  const { count } = await db.tournamentWaitlist.deleteMany({ where: { tournamentId, userId: user.id } });
  if (!count) return fail("شما در لیست انتظار نیستید.");
  changed(user.id, "waitlist_left", tournamentId);
  return ok(undefined, "از لیست انتظار خارج شدید.");
}

export async function removeFromWaitlist(entryId: unknown): Promise<ActionResult<undefined>> {
  const user = await actor();
  const w = typeof entryId === "string" ? await db.tournamentWaitlist.findUnique({ where: { id: entryId }, select: { id: true, tournamentId: true, name: true } }) : null;
  if (!user || !w || !(await manageableTournament(user, w.tournamentId))) return fail(DENIED);
  await db.tournamentWaitlist.delete({ where: { id: w.id } });
  changed(user.id, "waitlist_removed", w.tournamentId, { name: w.name });
  return ok(undefined, "از لیست انتظار حذف شد.");
}
