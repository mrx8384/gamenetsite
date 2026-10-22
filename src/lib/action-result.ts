export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/** First Zod issue per field, for showing next to inputs. */
export function zodFieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "_");
    out[key] ??= issue.message;
  }
  return out;
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

/**
 * Which unique constraint failed. Prisma 7 with driver adapters reports it under
 * meta.driverAdapterError.cause.constraint.index (e.g. "products_sku_key"); older shapes use meta.target.
 */
export function uniqueViolationTarget(error: unknown): string {
  const meta = (error as { meta?: unknown })?.meta;
  return meta ? JSON.stringify(meta) : "";
}

export const GENERIC_ERROR = "خطایی رخ داد. لطفاً دوباره تلاش کنید.";
export const RATE_LIMIT_ERROR = "تعداد تلاش‌ها بیش از حد مجاز است. لطفاً کمی بعد دوباره تلاش کنید.";
