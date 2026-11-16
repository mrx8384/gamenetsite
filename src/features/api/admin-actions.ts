"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { getRequestInfo } from "@/lib/request-info";
import { newApiKey } from "./auth";
import { API_SCOPE_KEYS } from "./scopes";

async function admin() {
  try {
    return (await assertRole(["ADMIN"])).user;
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

const schema = z.object({
  name: z.string().trim().min(2, "یک نام برای کلید بنویسید").max(80),
  scopes: z.array(z.enum(API_SCOPE_KEYS as [string, ...string[]])).min(1, "حداقل یک دسترسی انتخاب کنید"),
});

/** Returns the full key once; it is never shown again. */
export async function createApiKey(input: unknown): Promise<ActionResult<{ key: string }>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const k = newApiKey();
  const row = await db.apiKey.create({ data: { name: parsed.data.name, prefix: k.prefix, hash: k.hash, scopes: parsed.data.scopes, createdById: user.id }, select: { id: true } });
  const { ip } = await getRequestInfo();
  await audit({ actorId: user.id, action: "api_key.created", entity: "api_key", entityId: row.id, ip, meta: { name: parsed.data.name, scopes: parsed.data.scopes.join(",") } });
  revalidatePath("/admin/api-keys");
  return ok({ key: k.key }, "کلید ساخته شد.");
}

export async function revokeApiKey(id: string): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const { count } = await db.apiKey.updateMany({ where: { id: String(id), revokedAt: null }, data: { revokedAt: new Date() } });
  if (!count) return fail("کلید پیدا نشد.");
  const { ip } = await getRequestInfo();
  await audit({ actorId: user.id, action: "api_key.revoked", entity: "api_key", entityId: String(id), ip });
  revalidatePath("/admin/api-keys");
  return ok(undefined, "کلید باطل شد؛ برنامه‌ای که از آن استفاده می‌کرد دیگر دسترسی ندارد.");
}
