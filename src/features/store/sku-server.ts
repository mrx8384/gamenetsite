import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { nextAutoSku } from "./sku";

/** The next automatic code, from the codes already in the database. */
export async function generateSku(client: Prisma.TransactionClient | typeof db = db): Promise<string> {
  const rows = await client.product.findMany({ where: { sku: { startsWith: "ATM-" } }, select: { sku: true } });
  return nextAutoSku(rows.map((r) => r.sku));
}
