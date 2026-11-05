"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { toEnglishDigits } from "@/lib/format";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertUser, AuthorizationError } from "@/lib/auth/dal";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { fail, isUniqueViolation, ok, RATE_LIMIT_ERROR, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestInfo } from "@/lib/request-info";
import { slugify } from "@/lib/text";
import { BULK_MAX_LINES, parseBulkNames, participantKey } from "./bulk";
import { checkInOpen, RESERVED_SLUGS } from "./constants";
import { canCreateTournament, manageableTournament } from "./permissions";
import { matchDetailsSchema, participantNameSchema, readSignupQuestions, scoreSchema, signupSchema, tournamentSchema } from "./schemas";
import * as service from "./service";
import { getPaymentProvider } from "@/features/payments";
import { openGatewayPayment, paymentBlockedForTestMode, TEST_MODE_ERROR } from "@/features/payments/targets";
import { ENTRY_PAYMENT_MINUTES, expireStaleEntries, markEntryForRefund, takenPlaces } from "./entries";

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

const DENIED = "دسترسی غیرمجاز.";

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "tournament";
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 && !RESERVED_SLUGS.has(base) ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (!(await db.tournament.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  throw new Error("Could not allocate a tournament slug");
}

function toData(v: ReturnType<typeof tournamentSchema.parse>) {
  return {
    name: v.name,
    game: v.game,
    platform: v.platform || null,
    description: v.description || null,
    rules: v.rules || null,
    prize: v.prize || null,
    entryFeeNote: v.entryFeeNote || null,
    entryFee: v.entryFeeToman,
    startsAt: v.startsAt ? new Date(v.startsAt) : null,
    format: v.format,
    maxParticipants: v.maxParticipants ?? null,
    checkInMinutes: v.checkInMinutes ?? null,
    allowSelfRegistration: v.allowSelfRegistration,
    thirdPlaceMatch: v.thirdPlaceMatch,
    doubleRoundRobin: v.doubleRoundRobin,
    groupCount: v.format === "GROUPS_KNOCKOUT" ? (v.groupCount ?? null) : null,
    advancePerGroup: v.format === "GROUPS_KNOCKOUT" ? (v.advancePerGroup ?? null) : null,
    teamSize: v.teamSize ?? null,
    signupQuestions: v.signupQuestions,
    allowPlayerReports: v.allowPlayerReports,
    allowPredictions: v.allowPredictions,
    waitlistEnabled: v.waitlistEnabled,
    grandFinal: v.grandFinal,
    tiebreak: v.tiebreak,
    swissRounds: v.format === "SWISS" ? (v.swissRounds ?? null) : null,
    leaderboardRounds: v.format === "LEADERBOARD" ? (v.leaderboardRounds ?? 1) : null,
    pointsWin: v.pointsWin,
    pointsDraw: v.pointsDraw,
    pointsLoss: v.pointsLoss,
  };
}

// ───────────── Organizer: tournament ─────────────

export async function createTournament(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await actor();
  if (!user || !(await canCreateTournament(user))) return fail(DENIED);
  if (!(await rateLimit(`tournament-create:${user.id}`, 30, 60 * 60)).allowed) return fail(RATE_LIMIT_ERROR);
  const parsed = tournamentSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const t = await db.tournament.create({ data: { ...toData(parsed.data), slug: await uniqueSlug(parsed.data.name), organizerId: user.id }, select: { id: true } });
  changed(user.id, "created", t.id);
  return ok(t, "تورنومنت ساخته شد.");
}

export async function updateTournament(id: string, input: unknown): Promise<ActionResult<undefined>> {
  const user = await actor();
  const t = await manageableTournament(user, id, "owner");
  if (!user || !t) return fail(DENIED);
  const parsed = tournamentSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const data = toData(parsed.data);
  const started = t.status === "IN_PROGRESS" || t.status === "COMPLETED";
  if (started) {
    // Structure is locked once the bracket exists; only descriptive fields can change.
    const locked = ["format", "thirdPlaceMatch", "doubleRoundRobin", "groupCount", "advancePerGroup", "pointsWin", "pointsDraw", "pointsLoss", "grandFinal", "tiebreak", "swissRounds"] as const;
    for (const k of locked) if (data[k] !== t[k]) return fail("بعد از شروع تورنومنت، نوع جدول و امتیازها قابل تغییر نیست. برای تغییر، جدول را بازنشانی کنید.");
  }
  // Leaderboard rounds can grow while it runs (organizer adds columns); never shrink below that.
  if (started && t.format === "LEADERBOARD") data.leaderboardRounds = Math.max(data.leaderboardRounds ?? 1, t.leaderboardRounds ?? 1);
  await db.$transaction(async (tx) => {
    await tx.tournament.update({ where: { id }, data });
    // More places (or a free tournament) may let waiting players in.
    await service.promoteWaitlist(tx, id);
  });
  changed(user.id, "updated", id);
  return ok(undefined, "تغییرات ذخیره شد.");
}

export async function setTournamentStatus(id: string, status: unknown): Promise<ActionResult<undefined>> {
  const user = await actor();
  const t = await manageableTournament(user, id, "owner");
  if (!user || !t) return fail(DENIED);
  if (status !== "DRAFT" && status !== "REGISTRATION" && status !== "CANCELLED") return fail("وضعیت نامعتبر است.");
  if ((t.status === "IN_PROGRESS" || t.status === "COMPLETED") && status !== "CANCELLED") return fail("تورنومنت شروع شده است؛ ابتدا جدول را بازنشانی کنید.");
  await db.$transaction(async (tx) => {
    await tx.tournament.update({ where: { id }, data: { status } });
    if (status === "REGISTRATION") await service.promoteWaitlist(tx, id);
    if (status === "CANCELLED") await tx.tournamentEntry.updateMany({ where: { tournamentId: id, status: "PAID" }, data: { status: "REFUND_NEEDED", note: "تورنومنت لغو شد" } });
  });
  changed(user.id, `status_${status.toLowerCase()}`, id);
  return ok(undefined, status === "REGISTRATION" ? "ثبت‌نام باز شد و تورنومنت در سایت نمایش داده می‌شود." : status === "DRAFT" ? "تورنومنت به پیش‌نویس برگشت." : "تورنومنت لغو شد.");
}

export async function deleteTournament(id: string): Promise<ActionResult<undefined>> {
  const user = await actor();
  const t = await manageableTournament(user, id, "owner");
  if (!user || !t) return fail(DENIED);
  await db.$transaction(async (tx) => {
    // Paid entries stay as payment records (tournament name is kept on them); unfinished ones need a refund.
    if (t.status !== "COMPLETED") await tx.tournamentEntry.updateMany({ where: { tournamentId: id, status: "PAID" }, data: { status: "REFUND_NEEDED", note: "تورنومنت حذف شد" } });
    await tx.tournamentEntry.updateMany({ where: { tournamentId: id, status: "AWAITING_PAYMENT" }, data: { status: "CANCELLED", note: "تورنومنت حذف شد" } });
    await tx.tournament.delete({ where: { id } });
  });
  changed(user.id, "deleted", id, { name: t.name });
  return ok(undefined, "تورنومنت حذف شد.");
}

export async function startTournament(id: string): Promise<ActionResult<undefined>> {
  const user = await actor();
  if (!user || !(await manageableTournament(user, id))) return fail(DENIED);
  let removed = 0;
  try {
    removed = (await service.startTournament(id)).removed;
  } catch (e) {
    if (e instanceof service.TournamentError) return fail(e.message);
    throw e;
  }
  changed(user.id, "started", id, removed ? { removedNoCheckIn: removed } : undefined);
  return ok(undefined, removed ? `جدول ساخته شد و تورنومنت شروع شد. ${removed.toLocaleString("fa-IR")} نفر که حضورشان را تأیید نکرده بودند حذف شدند.` : "جدول ساخته شد و تورنومنت شروع شد.");
}

export async function resetTournament(id: string): Promise<ActionResult<undefined>> {
  const user = await actor();
  if (!user || !(await manageableTournament(user, id))) return fail(DENIED);
  await service.resetTournament(id);
  changed(user.id, "reset", id);
  return ok(undefined, "جدول و نتایج پاک شد؛ تورنومنت به مرحلهٔ ثبت‌نام برگشت.");
}

export async function startKnockout(id: string): Promise<ActionResult<undefined>> {
  const user = await actor();
  if (!user || !(await manageableTournament(user, id))) return fail(DENIED);
  try {
    await service.startKnockout(id);
  } catch (e) {
    if (e instanceof service.TournamentError) return fail(e.message);
    throw e;
  }
  changed(user.id, "knockout_started", id);
  return ok(undefined, "مرحلهٔ حذفی ساخته شد.");
}

// ───────────── Organizer: participants ─────────────

async function editableParticipants(user: Awaited<ReturnType<typeof actor>>, tournamentId: string) {
  const t = await manageableTournament(user, tournamentId);
  if (!t) return { error: DENIED } as const;
  if (t.status !== "DRAFT" && t.status !== "REGISTRATION") return { error: "بعد از شروع تورنومنت، فهرست شرکت‌کنندگان قفل است." } as const;
  return { t } as const;
}

export async function addParticipant(tournamentId: string, name: unknown): Promise<ActionResult<undefined>> {
  const user = await actor();
  const r = await editableParticipants(user, tournamentId);
  if (!user || "error" in r) return fail(r.error ?? DENIED);
  const n = participantNameSchema.safeParse(name);
  if (!n.success) return fail(n.error.issues[0]?.message ?? "نام نامعتبر است.");
  const count = await db.tournamentParticipant.count({ where: { tournamentId } });
  if (r.t.maxParticipants && count >= r.t.maxParticipants) return fail("ظرفیت تورنومنت تکمیل است.");
  try {
    await db.tournamentParticipant.create({ data: { tournamentId, name: n.data, seed: count + 1 } });
  } catch (e) {
    if (isUniqueViolation(e)) return fail("شرکت‌کننده‌ای با این نام وجود دارد.");
    throw e;
  }
  changed(user.id, "participant_added", tournamentId, { name: n.data });
  return ok(undefined, "شرکت‌کننده اضافه شد.");
}

export interface BulkAddResult {
  added: number;
  /** Names already in the tournament or repeated in the pasted list. */
  duplicates: string[];
  invalid: string[];
  /** Names left out because the tournament became full. */
  overCapacity: string[];
}

/** Adds many manual participants at once (one name per line), appended in list order. */
export async function addParticipantsBulk(tournamentId: string, text: unknown): Promise<ActionResult<BulkAddResult>> {
  const user = await actor();
  const r = await editableParticipants(user, tournamentId);
  if (!user || "error" in r) return fail(r.error ?? DENIED);
  if (typeof text !== "string" || text.length > BULK_MAX_LINES * 70) return fail("فهرست نام‌ها خیلی طولانی است.");
  const { names, repeated } = parseBulkNames(text);
  if (names.length === 0) return fail("هیچ نامی وارد نشده است.");
  if (names.length > BULK_MAX_LINES) return fail(`حداکثر ${BULK_MAX_LINES.toLocaleString("fa-IR")} نام در هر بار.`);

  const valid: string[] = [];
  const invalid: string[] = [];
  for (const n of names) {
    const v = participantNameSchema.safeParse(n);
    if (v.success) valid.push(v.data);
    else invalid.push(n);
  }

  const result = await db.$transaction(async (tx) => {
    // Same lock as bracket changes: parallel adds can't exceed capacity or reuse a seed.
    await tx.$queryRaw`SELECT id FROM tournaments WHERE id = ${tournamentId} FOR UPDATE`;
    const t = await tx.tournament.findUnique({ where: { id: tournamentId }, select: { status: true, maxParticipants: true } });
    if (!t || (t.status !== "DRAFT" && t.status !== "REGISTRATION")) return null;
    const existing = await tx.tournamentParticipant.findMany({ where: { tournamentId }, select: { name: true, seed: true } });
    const taken = new Set(existing.map((p) => participantKey(p.name)));
    let seed = existing.reduce((m, p) => Math.max(m, p.seed), 0);
    const free = t.maxParticipants ? Math.max(0, t.maxParticipants - existing.length) : Infinity;
    const duplicates = [...repeated];
    const toAdd: string[] = [];
    const overCapacity: string[] = [];
    for (const n of valid) {
      if (taken.has(participantKey(n))) duplicates.push(n);
      else if (toAdd.length >= free) overCapacity.push(n);
      else {
        taken.add(participantKey(n));
        toAdd.push(n);
      }
    }
    if (toAdd.length) await tx.tournamentParticipant.createMany({ data: toAdd.map((name) => ({ tournamentId, name, seed: ++seed })) });
    return { added: toAdd.length, duplicates, invalid, overCapacity };
  });
  if (!result) return fail("بعد از شروع تورنومنت، فهرست شرکت‌کنندگان قفل است.");
  if (result.added) changed(user.id, "participants_bulk_added", tournamentId, { count: result.added });
  const fa = (n: number) => n.toLocaleString("fa-IR");
  const skipped = result.duplicates.length + result.invalid.length + result.overCapacity.length;
  const message = result.added ? `${fa(result.added)} شرکت‌کننده اضافه شد.${skipped ? ` ${fa(skipped)} نام اضافه نشد.` : ""}` : "هیچ نام جدیدی اضافه نشد.";
  return ok(result, message);
}

async function renumber(tournamentId: string, orderedIds: string[]) {
  // Two passes avoid temporary duplicate seeds.
  await db.$transaction([
    ...orderedIds.map((id, i) => db.tournamentParticipant.update({ where: { id }, data: { seed: 10000 + i } })),
    ...orderedIds.map((id, i) => db.tournamentParticipant.update({ where: { id }, data: { seed: i + 1 } })),
  ]);
}

export async function removeParticipant(participantId: string): Promise<ActionResult<undefined>> {
  const user = await actor();
  const p = typeof participantId === "string" ? await db.tournamentParticipant.findUnique({ where: { id: participantId } }) : null;
  if (!user || !p) return fail(DENIED);
  const r = await editableParticipants(user, p.tournamentId);
  if ("error" in r) return fail(r.error ?? DENIED);
  await db.$transaction(async (tx) => {
    await markEntryForRefund(tx, p.id, "شرکت‌کننده توسط برگزارکننده حذف شد");
    await tx.tournamentParticipant.delete({ where: { id: p.id } });
  });
  const rest = await db.tournamentParticipant.findMany({ where: { tournamentId: p.tournamentId }, orderBy: { seed: "asc" }, select: { id: true } });
  await renumber(p.tournamentId, rest.map((x) => x.id));
  await db.$transaction((tx) => service.promoteWaitlist(tx, p.tournamentId));
  changed(user.id, "participant_removed", p.tournamentId, { name: p.name });
  return ok(undefined, "شرکت‌کننده حذف شد.");
}

export async function moveParticipant(participantId: string, direction: "up" | "down"): Promise<ActionResult<undefined>> {
  const user = await actor();
  const p = typeof participantId === "string" ? await db.tournamentParticipant.findUnique({ where: { id: participantId } }) : null;
  if (!user || !p || (direction !== "up" && direction !== "down")) return fail(DENIED);
  const r = await editableParticipants(user, p.tournamentId);
  if ("error" in r) return fail(r.error ?? DENIED);
  const list = await db.tournamentParticipant.findMany({ where: { tournamentId: p.tournamentId }, orderBy: { seed: "asc" }, select: { id: true } });
  const i = list.findIndex((x) => x.id === p.id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return ok(undefined);
  [list[i], list[j]] = [list[j], list[i]];
  await renumber(p.tournamentId, list.map((x) => x.id));
  changed(user.id, "participant_moved", p.tournamentId);
  return ok(undefined);
}

export async function shuffleParticipants(tournamentId: string): Promise<ActionResult<undefined>> {
  const user = await actor();
  const r = await editableParticipants(user, tournamentId);
  if (!user || "error" in r) return fail(r.error ?? DENIED);
  const list = await db.tournamentParticipant.findMany({ where: { tournamentId }, select: { id: true } });
  const ids = list.map((x) => x.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  await renumber(tournamentId, ids);
  changed(user.id, "participants_shuffled", tournamentId);
  return ok(undefined, "ترتیب شرکت‌کنندگان تصادفی شد.");
}

// ───────────── Organizer: results ─────────────

export async function reportMatch(matchId: string, input: unknown): Promise<ActionResult<undefined>> {
  const user = await actor();
  const m = typeof matchId === "string" ? await db.tournamentMatch.findUnique({ where: { id: matchId }, select: { tournamentId: true } }) : null;
  if (!user || !m || !(await manageableTournament(user, m.tournamentId))) return fail(DENIED);
  const parsed = scoreSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  try {
    await service.reportMatch(matchId, parsed.data);
  } catch (e) {
    if (e instanceof service.TournamentError) return fail(e.message);
    throw e;
  }
  changed(user.id, "match_reported", m.tournamentId, { matchId, ...parsed.data });
  return ok(undefined, "نتیجه ثبت شد.");
}

export async function clearMatch(matchId: string): Promise<ActionResult<undefined>> {
  const user = await actor();
  const m = typeof matchId === "string" ? await db.tournamentMatch.findUnique({ where: { id: matchId }, select: { tournamentId: true } }) : null;
  if (!user || !m || !(await manageableTournament(user, m.tournamentId))) return fail(DENIED);
  try {
    await service.clearMatch(matchId);
  } catch (e) {
    if (e instanceof service.TournamentError) return fail(e.message);
    throw e;
  }
  changed(user.id, "match_cleared", m.tournamentId, { matchId });
  return ok(undefined, "نتیجه پاک شد.");
}

// ───────────── Players: self registration ─────────────

type Signup = { name: string; members: string[]; answers: { q: string; a: string }[] };

export async function registerForTournament(tournamentId: string, input: unknown): Promise<ActionResult<{ redirectTo?: string }>> {
  const user = await actor();
  if (!user) return fail("برای ثبت‌نام ابتدا وارد حساب کاربری شوید.");
  if (typeof tournamentId !== "string") return fail("درخواست نامعتبر است.");
  if (!(await rateLimit(`tournament-register:${user.id}`, 20, 60 * 60)).allowed) return fail(RATE_LIMIT_ERROR);
  const info = await db.tournament.findUnique({ where: { id: tournamentId }, select: { entryFee: true, teamSize: true, signupQuestions: true } });
  if (!info) return fail("ثبت‌نام این تورنومنت باز نیست.");
  const parsed = signupSchema({ teamSize: info.teamSize, questions: readSignupQuestions(info.signupQuestions) }).safeParse(typeof input === "string" ? { name: input } : input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "اطلاعات نامعتبر است.", zodFieldErrors(parsed.error.issues));
  const signup: Signup = parsed.data;
  if (info.entryFee > BigInt(0)) return registerPaid(user, tournamentId, signup);
  let waitlisted = false;
  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tournaments WHERE id = ${tournamentId} FOR UPDATE`;
      const t = await tx.tournament.findUnique({ where: { id: tournamentId } });
      if (!t || t.status !== "REGISTRATION" || !t.allowSelfRegistration) throw new service.TournamentError("ثبت‌نام این تورنومنت باز نیست.");
      const count = await tx.tournamentParticipant.count({ where: { tournamentId } });
      if (t.maxParticipants && count >= t.maxParticipants) {
        if (!t.waitlistEnabled) throw new service.TournamentError("ظرفیت تورنومنت تکمیل است.");
        if (await tx.tournamentParticipant.findFirst({ where: { tournamentId, userId: user.id }, select: { id: true } })) throw new service.TournamentError("شما قبلاً در این تورنومنت ثبت‌نام کرده‌اید.");
        await tx.tournamentWaitlist.create({ data: { tournamentId, userId: user.id, name: signup.name, members: signup.members, answers: signup.answers } });
        waitlisted = true;
        return;
      }
      await tx.tournamentWaitlist.deleteMany({ where: { tournamentId, userId: user.id } });
      await tx.tournamentParticipant.create({ data: { tournamentId, userId: user.id, name: signup.name, seed: count + 1, members: signup.members, answers: signup.answers } });
    });
  } catch (e) {
    if (e instanceof service.TournamentError) return fail(e.message);
    if (isUniqueViolation(e)) {
      const mine = await db.tournamentParticipant.findFirst({ where: { tournamentId, userId: user.id }, select: { id: true } });
      const waiting = !mine && (await db.tournamentWaitlist.findFirst({ where: { tournamentId, userId: user.id }, select: { id: true } }));
      if (waiting) return fail("شما در لیست انتظار این تورنومنت هستید.");
      return fail(mine ? "شما قبلاً در این تورنومنت ثبت‌نام کرده‌اید." : "این نام قبلاً ثبت شده است؛ نام دیگری انتخاب کنید.", mine ? undefined : { name: "این نام قبلاً ثبت شده است." });
    }
    throw e;
  }
  changed(user.id, waitlisted ? "waitlisted" : "registered", tournamentId);
  return ok({}, waitlisted ? "ظرفیت پر است؛ شما در لیست انتظار قرار گرفتید. اگر جایی خالی شود خودکار اضافه می‌شوید." : "ثبت‌نام شما انجام شد.");
}

/**
 * Registration with an online fee: holds a place for ENTRY_PAYMENT_MINUTES and sends the player to the
 * gateway. The participant is added only when the payment is confirmed (see entries.ts).
 */
async function registerPaid(user: { id: string; role: string; phone: string | null }, tournamentId: string, signup: Signup): Promise<ActionResult<{ redirectTo?: string }>> {
  const name = signup.name;
  const provider = getPaymentProvider();
  if (!provider) return fail("پرداخت آنلاین در حال حاضر فعال نیست؛ برای ثبت‌نام با برگزارکننده تماس بگیرید.");
  if (paymentBlockedForTestMode(user.role)) return fail(TEST_MODE_ERROR);
  await expireStaleEntries();
  let created: { paymentId: string; entryId: string; amount: bigint; tournamentName: string };
  try {
    created = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tournaments WHERE id = ${tournamentId} FOR UPDATE`;
      const t = await tx.tournament.findUnique({ where: { id: tournamentId } });
      if (!t || t.status !== "REGISTRATION" || !t.allowSelfRegistration) throw new service.TournamentError("ثبت‌نام این تورنومنت باز نیست.");
      if (await tx.tournamentParticipant.findFirst({ where: { tournamentId, userId: user.id }, select: { id: true } })) throw new service.TournamentError("شما قبلاً در این تورنومنت ثبت‌نام کرده‌اید.");
      // A new attempt replaces the player's earlier unpaid one.
      await tx.tournamentEntry.updateMany({ where: { tournamentId, userId: user.id, status: "AWAITING_PAYMENT" }, data: { status: "CANCELLED", note: "جایگزین با تلاش جدید" } });
      if (t.maxParticipants && (await takenPlaces(tx, tournamentId)) >= t.maxParticipants) throw new service.TournamentError("ظرفیت تورنومنت تکمیل است.");
      const clash =
        (await tx.tournamentParticipant.findFirst({ where: { tournamentId, name }, select: { id: true } })) ??
        (await tx.tournamentEntry.findFirst({ where: { tournamentId, name, status: "AWAITING_PAYMENT", paymentDeadline: { gt: new Date() } }, select: { id: true } }));
      if (clash) throw new service.TournamentError("این نام قبلاً ثبت شده است؛ نام دیگری انتخاب کنید.");
      const payment = await tx.payment.create({ data: { provider: provider.key, amount: t.entryFee }, select: { id: true } });
      const entry = await tx.tournamentEntry.create({
        data: {
          tournamentId,
          tournamentName: t.name,
          userId: user.id,
          name,
          members: signup.members,
          answers: signup.answers,
          amount: t.entryFee,
          paymentId: payment.id,
          isTest: provider.testMode === true,
          paymentDeadline: new Date(Date.now() + ENTRY_PAYMENT_MINUTES * 60_000),
        },
        select: { id: true },
      });
      return { paymentId: payment.id, entryId: entry.id, amount: t.entryFee, tournamentName: t.name };
    });
  } catch (e) {
    if (e instanceof service.TournamentError) return fail(e.message, e.message.includes("نام") ? { name: e.message } : undefined);
    throw e;
  }
  changed(user.id, "payment_started", tournamentId, { entryId: created.entryId });
  try {
    const redirectTo = await openGatewayPayment(created.paymentId, { amount: created.amount, description: `ثبت‌نام تورنومنت ${created.tournamentName} — ${name}`, mobile: user.phone });
    return ok({ redirectTo });
  } catch (e) {
    console.error("[tournaments] payment start failed", e);
    await db.$transaction([
      db.payment.update({ where: { id: created.paymentId }, data: { status: "CANCELLED" } }),
      db.tournamentEntry.update({ where: { id: created.entryId }, data: { status: "CANCELLED", note: "خطا در اتصال به درگاه" } }),
    ]);
    return fail("اتصال به درگاه پرداخت ناموفق بود؛ لطفاً دوباره تلاش کنید.");
  }
}

export async function withdrawFromTournament(tournamentId: string): Promise<ActionResult<undefined>> {
  const user = await actor();
  if (!user) return fail(DENIED);
  const t = typeof tournamentId === "string" ? await db.tournament.findUnique({ where: { id: tournamentId }, select: { status: true } }) : null;
  if (!t || t.status !== "REGISTRATION") return fail("انصراف فقط پیش از شروع تورنومنت ممکن است.");
  const p = await db.tournamentParticipant.findFirst({ where: { tournamentId, userId: user.id } });
  if (!p) return fail("شما در این تورنومنت ثبت‌نام نکرده‌اید.");
  if (await db.tournamentEntry.findFirst({ where: { participantId: p.id, status: "PAID" }, select: { id: true } })) {
    return fail("ثبت‌نام شما پولی بوده است؛ برای انصراف و بازگشت هزینه با پشتیبانی اتم تماس بگیرید.");
  }
  await db.tournamentParticipant.delete({ where: { id: p.id } });
  const rest = await db.tournamentParticipant.findMany({ where: { tournamentId }, orderBy: { seed: "asc" }, select: { id: true } });
  await renumber(tournamentId, rest.map((x) => x.id));
  await db.$transaction((tx) => service.promoteWaitlist(tx, tournamentId));
  changed(user.id, "withdrawn", tournamentId);
  return ok(undefined, "انصراف شما ثبت شد.");
}

// ───────────── Admin: paid registrations ─────────────

/** Records that the money of a paid registration was returned to the player (done outside the site). */
export async function markEntryRefunded(entryId: unknown): Promise<ActionResult<undefined>> {
  const user = await actor();
  if (!user || user.role !== "ADMIN") return fail(DENIED);
  if (typeof entryId !== "string" || !entryId) return fail("درخواست نامعتبر است.");
  const { count } = await db.tournamentEntry.updateMany({ where: { id: entryId, status: "REFUND_NEEDED" }, data: { status: "REFUNDED" } });
  if (!count) return fail("این پرداخت در انتظار بازپرداخت نیست.");
  const { ip } = await getRequestInfo();
  await audit({ actorId: user.id, action: "tournaments.entry_refunded", entity: "tournament_entry", entityId: entryId, ip });
  return ok(undefined, "بازپرداخت ثبت شد.");
}

// ───────────── Organizer: match details, disqualification, check-in ─────────────

async function managedMatch(matchId: unknown) {
  const user = await actor();
  const m = typeof matchId === "string" ? await db.tournamentMatch.findUnique({ where: { id: matchId }, select: { tournamentId: true } }) : null;
  if (!user || !m || !(await manageableTournament(user, m.tournamentId))) return null;
  return { user, tournamentId: m.tournamentId, matchId: matchId as string };
}

/** «در حال بازی» on/off (shown live on the bracket). */
export async function setMatchUnderway(matchId: unknown, on: unknown): Promise<ActionResult<undefined>> {
  const r = await managedMatch(matchId);
  if (!r || typeof on !== "boolean") return fail(DENIED);
  try {
    await service.setMatchUnderway(r.matchId, on);
  } catch (e) {
    if (e instanceof service.TournamentError) return fail(e.message);
    throw e;
  }
  changed(r.user.id, on ? "match_underway" : "match_not_underway", r.tournamentId, { matchId: r.matchId });
  return ok(undefined, on ? "بازی «در حال انجام» شد." : "وضعیت «در حال انجام» برداشته شد.");
}

/** Console / table and planned time of a match. */
export async function setMatchDetails(matchId: unknown, input: unknown): Promise<ActionResult<undefined>> {
  const r = await managedMatch(matchId);
  if (!r) return fail(DENIED);
  const parsed = matchDetailsSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  try {
    await service.setMatchDetails(r.matchId, { station: parsed.data.station || null, scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null });
  } catch (e) {
    if (e instanceof service.TournamentError) return fail(e.message);
    throw e;
  }
  changed(r.user.id, "match_details", r.tournamentId, { matchId: r.matchId });
  return ok(undefined, "مشخصات بازی ذخیره شد.");
}

async function managedParticipant(participantId: unknown) {
  const user = await actor();
  const p = typeof participantId === "string" ? await db.tournamentParticipant.findUnique({ where: { id: participantId }, select: { id: true, tournamentId: true, name: true } }) : null;
  if (!user || !p) return null;
  const t = await manageableTournament(user, p.tournamentId);
  return t ? { user, p, t } : null;
}

/** Removes a player during the tournament; their remaining matches go to the opponents. */
export async function disqualifyParticipant(participantId: unknown): Promise<ActionResult<undefined>> {
  const r = await managedParticipant(participantId);
  if (!r) return fail(DENIED);
  try {
    await service.disqualifyParticipant(r.p.id);
  } catch (e) {
    if (e instanceof service.TournamentError) return fail(e.message);
    throw e;
  }
  changed(r.user.id, "participant_disqualified", r.t.id, { name: r.p.name });
  return ok(undefined, `«${r.p.name}» حذف شد و بازی‌های باقی‌مانده‌اش به حریف داده شد.`);
}

export async function reinstateParticipant(participantId: unknown): Promise<ActionResult<undefined>> {
  const r = await managedParticipant(participantId);
  if (!r) return fail(DENIED);
  await service.reinstateParticipant(r.p.id);
  changed(r.user.id, "participant_reinstated", r.t.id, { name: r.p.name });
  return ok(undefined, `«${r.p.name}» برگردانده شد. نتیجه‌های فنیِ ثبت‌شده را در صورت نیاز دستی پاک کنید.`);
}

/** Organizer confirms (or removes) a player's check-in before the start. */
export async function setParticipantCheckIn(participantId: unknown, on: unknown): Promise<ActionResult<undefined>> {
  const r = await managedParticipant(participantId);
  if (!r || typeof on !== "boolean") return fail(DENIED);
  if (r.t.status !== "DRAFT" && r.t.status !== "REGISTRATION") return fail("بعد از شروع، چک‌این تغییر نمی‌کند.");
  await db.tournamentParticipant.update({ where: { id: r.p.id }, data: { checkedInAt: on ? new Date() : null } });
  changed(r.user.id, on ? "participant_checked_in" : "participant_check_in_removed", r.t.id, { name: r.p.name });
  return ok(undefined, on ? "حضور تأیید شد." : "تأیید حضور برداشته شد.");
}

/** A registered player confirms attendance while the check-in window is open. */
export async function checkInToTournament(tournamentId: unknown): Promise<ActionResult<undefined>> {
  const user = await actor();
  if (!user) return fail("ابتدا وارد حساب کاربری شوید.");
  if (typeof tournamentId !== "string") return fail("درخواست نامعتبر است.");
  const t = await db.tournament.findUnique({ where: { id: tournamentId }, select: { status: true, startsAt: true, checkInMinutes: true } });
  if (!t || t.status !== "REGISTRATION" || t.checkInMinutes === null || !t.startsAt) return fail("چک‌این این تورنومنت باز نیست.");
  if (!checkInOpen(t.startsAt, t.checkInMinutes)) return fail(`چک‌این از ${t.checkInMinutes.toLocaleString("fa-IR")} دقیقه قبل از شروع باز می‌شود.`);
  const { count } = await db.tournamentParticipant.updateMany({ where: { tournamentId, userId: user.id, checkedInAt: null }, data: { checkedInAt: new Date() } });
  if (!count) return fail("شما در این تورنومنت ثبت‌نام نکرده‌اید یا قبلاً حضورتان را تأیید کرده‌اید.");
  changed(user.id, "checked_in", tournamentId);
  return ok(undefined, "حضور شما تأیید شد.");
}

// ───────────── Swiss / leaderboard ─────────────

async function runService(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    if (e instanceof service.TournamentError) return e.message;
    throw e;
  }
}

/** Swiss: pair the next round once the current one is complete. */
export async function nextSwissRound(tournamentId: unknown): Promise<ActionResult<undefined>> {
  const user = await actor();
  if (!user || typeof tournamentId !== "string" || !(await manageableTournament(user, tournamentId))) return fail(DENIED);
  let round = 0;
  const err = await runService(async () => (round = await service.nextSwissRound(tournamentId)));
  if (err) return fail(err);
  changed(user.id, "swiss_round", tournamentId, { round });
  return ok(undefined, `دور ${round.toLocaleString("fa-IR")} جفت شد.`);
}

const pointsSchema = z.object({
  participantId: z.string().min(1).max(40),
  round: z.number().int().min(1).max(50),
  points: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : typeof v === "string" ? toEnglishDigits(v).trim() : v), z.coerce.number("امتیاز معتبر نیست").int("امتیاز باید عدد صحیح باشد").min(-9999, "امتیاز معتبر نیست").max(99999, "امتیاز معتبر نیست").nullable()),
});

/** Leaderboard: points of one participant in one round (empty clears it). */
export async function setLeaderboardPoints(tournamentId: unknown, input: unknown): Promise<ActionResult<undefined>> {
  const user = await actor();
  if (!user || typeof tournamentId !== "string" || !(await manageableTournament(user, tournamentId))) return fail(DENIED);
  const parsed = pointsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "امتیاز معتبر نیست");
  const { participantId, round, points } = parsed.data;
  const err = await runService(() => service.setLeaderboardPoints(tournamentId, participantId, round, points));
  if (err) return fail(err);
  updateTag(CACHE_TAGS.tournaments);
  return ok(undefined, "ذخیره شد.");
}

export async function addLeaderboardRound(tournamentId: unknown): Promise<ActionResult<undefined>> {
  const user = await actor();
  if (!user || typeof tournamentId !== "string" || !(await manageableTournament(user, tournamentId))) return fail(DENIED);
  const err = await runService(() => service.addLeaderboardRound(tournamentId));
  if (err) return fail(err);
  changed(user.id, "leaderboard_round_added", tournamentId);
  return ok(undefined, "یک دور اضافه شد.");
}

export async function finishLeaderboard(tournamentId: unknown, finish: unknown): Promise<ActionResult<undefined>> {
  const user = await actor();
  if (!user || typeof tournamentId !== "string" || typeof finish !== "boolean" || !(await manageableTournament(user, tournamentId))) return fail(DENIED);
  const err = await runService(() => service.finishLeaderboard(tournamentId, finish));
  if (err) return fail(err);
  changed(user.id, finish ? "leaderboard_finished" : "leaderboard_reopened", tournamentId);
  return ok(undefined, finish ? "تورنومنت پایان یافت و رتبه‌ها بر اساس جمع امتیاز ثبت شد." : "تورنومنت دوباره باز شد.");
}
