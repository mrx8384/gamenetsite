import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { discountFor, discountProblem, normalizeDiscountCode, type DiscountScope } from "./rules";

type Tx = Prisma.TransactionClient;

export class DiscountError extends Error {}

/** Uses that still count: their order / booking / tournament entry was not cancelled. */
const counting = {
  OR: [
    { order: { status: { not: "CANCELLED" as const } } },
    { booking: { status: { not: "CANCELLED" as const } } },
    { tournamentEntry: { status: { not: "CANCELLED" as const } } },
  ],
} satisfies Prisma.DiscountRedemptionWhereInput;

async function evaluate(client: Tx | typeof db, input: { code: string; scope: DiscountScope; amount: bigint; userId: string | null }, lock: boolean) {
  const code = normalizeDiscountCode(input.code);
  if (code.length < 3 || code.length > 40) throw new DiscountError("کد تخفیف را درست وارد کنید.");
  if (lock) await (client as Tx).$queryRaw`SELECT id FROM discount_codes WHERE code = ${code} FOR UPDATE`;
  const rule = await client.discountCode.findUnique({ where: { code } });
  if (!rule) throw new DiscountError("کد تخفیف پیدا نشد.");
  const [used, usedByUser] = await Promise.all([
    client.discountRedemption.count({ where: { codeId: rule.id, ...counting } }),
    input.userId ? client.discountRedemption.count({ where: { codeId: rule.id, userId: input.userId, ...counting } }) : Promise.resolve(0),
  ]);
  const problem = discountProblem(rule, { scope: input.scope, amount: input.amount, now: new Date(), used, usedByUser, hasUser: !!input.userId });
  if (problem) throw new DiscountError(problem);
  return { id: rule.id, code: rule.code, title: rule.title, discount: discountFor(rule, input.amount) };
}

/** Preview for forms (checked again, under a lock, when the purchase is created). */
export function previewDiscount(input: { code: string; scope: DiscountScope; amount: bigint; userId: string | null }) {
  return evaluate(db, input, false);
}

/** Inside the purchase transaction: locks the code row so usage limits hold under concurrency. */
export function lockDiscount(tx: Tx, input: { code: string; scope: DiscountScope; amount: bigint; userId: string | null }) {
  return evaluate(tx, input, true);
}

export async function recordRedemption(
  tx: Tx,
  input: { codeId: string; userId: string | null; scope: DiscountScope; amount: bigint; orderId?: string; bookingId?: string; tournamentEntryId?: string },
) {
  await tx.discountRedemption.create({ data: input });
}
