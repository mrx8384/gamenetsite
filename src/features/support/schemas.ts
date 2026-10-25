import { z } from "zod";
import { SUPPORT_MAX_LENGTH } from "./constants";

export const messageBodySchema = z
  .string({ error: "متن پیام را بنویسید." })
  .transform((v) => v.replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim())
  .pipe(
    z
      .string()
      .min(1, "متن پیام را بنویسید.")
      .max(SUPPORT_MAX_LENGTH, `پیام حداکثر ${SUPPORT_MAX_LENGTH.toLocaleString("fa-IR")} کاراکتر است.`),
  );

/** ISO timestamp cursor from the client; invalid → undefined. */
export function parseCursor(v: string | null): Date | undefined {
  if (!v || v.length > 40) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
