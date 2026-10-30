"use server";

import { updateTag } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertUser, AuthorizationError } from "@/lib/auth/dal";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { fail, isUniqueViolation, ok, RATE_LIMIT_ERROR, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestInfo } from "@/lib/request-info";
import { slugify } from "@/lib/text";
import { BULK_MAX_LINES, parseBulkNames, participantKey } from "./bulk";
import { RESERVED_SLUGS } from "./constants";
import { canCreateTournament, manageableTournament } from "./permissions";
import { participantNameSchema, scoreSchema, tournamentSchema } from "./schemas";
import * as service from "./service";

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
    startsAt: v.startsAt ? new Date(v.startsAt) : null,
    format: v.format,
    maxParticipants: v.maxParticipants ?? null,
    allowSelfRegistration: v.allowSelfRegistration,
    thirdPlaceMatch: v.thirdPlaceMatch,
    doubleRoundRobin: v.doubleRoundRobin,
    groupCount: v.format === "GROUPS_KNOCKOUT" ? (v.groupCount ?? null) : null,
    advancePerGroup: v.format === "GROUPS_KNOCKOUT" ? (v.advancePerGroup ?? null) : null,
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
  const t = await manageableTournament(user, id);
  if (!user || !t) return fail(DENIED);
  const parsed = tournamentSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const data = toData(parsed.data);
  const started = t.status === "IN_PROGRESS" || t.status === "COMPLETED";
  if (started) {
    // Structure is locked once the bracket exists; only descriptive fields can change.
    const locked = ["format", "thirdPlaceMatch", "doubleRoundRobin", "groupCount", "advancePerGroup", "pointsWin", "pointsDraw", "pointsLoss"] as const;
    for (const k of locked) if (data[k] !== t[k]) return fail("بعد از شروع تورنومنت، نوع جدول و امتیازها قابل تغییر نیست. برای تغییر، جدول را بازنشانی کنید.");
  }
  await db.tournament.update({ where: { id }, data });
  changed(user.id, "updated", id);
  return ok(undefined, "تغییرات ذخیره شد.");
}

export async function setTournamentStatus(id: string, status: unknown): Promise<ActionResult<undefined>> {
  const user = await actor();
  const t = await manageableTournament(user, id);
  if (!user || !t) return fail(DENIED);
  if (status !== "DRAFT" && status !== "REGISTRATION" && status !== "CANCELLED") return fail("وضعیت نامعتبر است.");
  if ((t.status === "IN_PROGRESS" || t.status === "COMPLETED") && status !== "CANCELLED") return fail("تورنومنت شروع شده است؛ ابتدا جدول را بازنشانی کنید.");
  await db.tournament.update({ where: { id }, data: { status } });
  changed(user.id, `status_${status.toLowerCase()}`, id);
  return ok(undefined, status === "REGISTRATION" ? "ثبت‌نام باز شد و تورنومنت در سایت نمایش داده می‌شود." : status === "DRAFT" ? "تورنومنت به پیش‌نویس برگشت." : "تورنومنت لغو شد.");
}

export async function deleteTournament(id: string): Promise<ActionResult<undefined>> {
  const user = await actor();
  const t = await manageableTournament(user, id);
  if (!user || !t) return fail(DENIED);
  await db.tournament.delete({ where: { id } });
  changed(user.id, "deleted", id, { name: t.name });
  return ok(undefined, "تورنومنت حذف شد.");
}

export async function startTournament(id: string): Promise<ActionResult<undefined>> {
  const user = await actor();
  if (!user || !(await manageableTournament(user, id))) return fail(DENIED);
  try {
    await service.startTournament(id);
  } catch (e) {
    if (e instanceof service.TournamentError) return fail(e.message);
    throw e;
  }
  changed(user.id, "started", id);
  return ok(undefined, "جدول ساخته شد و تورنومنت شروع شد.");
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
  await db.tournamentParticipant.delete({ where: { id: p.id } });
  const rest = await db.tournamentParticipant.findMany({ where: { tournamentId: p.tournamentId }, orderBy: { seed: "asc" }, select: { id: true } });
  await renumber(p.tournamentId, rest.map((x) => x.id));
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

export async function registerForTournament(tournamentId: string, displayName: unknown): Promise<ActionResult<undefined>> {
  const user = await actor();
  if (!user) return fail("برای ثبت‌نام ابتدا وارد حساب کاربری شوید.");
  if (typeof tournamentId !== "string") return fail("درخواست نامعتبر است.");
  if (!(await rateLimit(`tournament-register:${user.id}`, 20, 60 * 60)).allowed) return fail(RATE_LIMIT_ERROR);
  const name = participantNameSchema.safeParse(displayName);
  if (!name.success) return fail(name.error.issues[0]?.message ?? "نام نامعتبر است.", { name: name.error.issues[0]?.message ?? "" });
  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tournaments WHERE id = ${tournamentId} FOR UPDATE`;
      const t = await tx.tournament.findUnique({ where: { id: tournamentId } });
      if (!t || t.status !== "REGISTRATION" || !t.allowSelfRegistration) throw new service.TournamentError("ثبت‌نام این تورنومنت باز نیست.");
      const count = await tx.tournamentParticipant.count({ where: { tournamentId } });
      if (t.maxParticipants && count >= t.maxParticipants) throw new service.TournamentError("ظرفیت تورنومنت تکمیل است.");
      await tx.tournamentParticipant.create({ data: { tournamentId, userId: user.id, name: name.data, seed: count + 1 } });
    });
  } catch (e) {
    if (e instanceof service.TournamentError) return fail(e.message);
    if (isUniqueViolation(e)) {
      const mine = await db.tournamentParticipant.findFirst({ where: { tournamentId, userId: user.id }, select: { id: true } });
      return fail(mine ? "شما قبلاً در این تورنومنت ثبت‌نام کرده‌اید." : "این نام قبلاً ثبت شده است؛ نام دیگری انتخاب کنید.", mine ? undefined : { name: "این نام قبلاً ثبت شده است." });
    }
    throw e;
  }
  changed(user.id, "registered", tournamentId);
  return ok(undefined, "ثبت‌نام شما انجام شد.");
}

export async function withdrawFromTournament(tournamentId: string): Promise<ActionResult<undefined>> {
  const user = await actor();
  if (!user) return fail(DENIED);
  const t = typeof tournamentId === "string" ? await db.tournament.findUnique({ where: { id: tournamentId }, select: { status: true } }) : null;
  if (!t || t.status !== "REGISTRATION") return fail("انصراف فقط پیش از شروع تورنومنت ممکن است.");
  const p = await db.tournamentParticipant.findFirst({ where: { tournamentId, userId: user.id } });
  if (!p) return fail("شما در این تورنومنت ثبت‌نام نکرده‌اید.");
  await db.tournamentParticipant.delete({ where: { id: p.id } });
  const rest = await db.tournamentParticipant.findMany({ where: { tournamentId }, orderBy: { seed: "asc" }, select: { id: true } });
  await renumber(tournamentId, rest.map((x) => x.id));
  changed(user.id, "withdrawn", tournamentId);
  return ok(undefined, "انصراف شما ثبت شد.");
}
