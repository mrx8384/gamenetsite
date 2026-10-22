"use server";

import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { fail, ok, RATE_LIMIT_ERROR, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { storeImage, UploadError } from "./storage";

const MAX_FILES = 1; // one image per request keeps the global body limit small
const FOLDERS = ["products", "categories", "news", "catalog"] as const;

export type UploadedImage = { id: string; storageKey: string };

/** Admin-only image upload (Server Action: built-in CSRF origin check). */
export async function uploadImages(formData: FormData): Promise<ActionResult<UploadedImage[]>> {
  let userId: string;
  try {
    userId = (await assertRole(["ADMIN"])).user.id;
  } catch (e) {
    if (e instanceof AuthorizationError) return fail("دسترسی غیرمجاز.");
    throw e;
  }
  if (!(await rateLimit(`upload:${userId}`, 120, 60 * 60)).allowed) return fail(RATE_LIMIT_ERROR);

  const folder = FOLDERS.find((f) => f === formData.get("folder")) ?? "products";
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return fail("تصویری انتخاب نشده است.");
  if (files.length > MAX_FILES) return fail("در هر درخواست فقط یک تصویر مجاز است.");

  const uploaded: UploadedImage[] = [];
  for (const file of files) {
    try {
      const media = await storeImage(Buffer.from(await file.arrayBuffer()), { folder, uploaderId: userId, originalName: file.name });
      uploaded.push({ id: media.id, storageKey: media.storageKey });
    } catch (e) {
      if (e instanceof UploadError) return fail(`«${file.name}»: ${e.message}`);
      console.error("[upload] failed", e);
      return fail("ذخیرهٔ تصویر ناموفق بود.");
    }
  }
  return ok(uploaded, `${uploaded.length.toLocaleString("fa-IR")} تصویر بارگذاری شد.`);
}
