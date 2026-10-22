import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export async function audit(entry: {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Prisma.InputJsonValue;
  ip?: string | null;
}): Promise<void> {
  try {
    await db.auditLog.create({ data: { ...entry, entityId: entry.entityId ?? null } });
  } catch (error) {
    // Auditing must never break the user action.
    console.error("[audit] failed to write entry", error);
  }
}
