import { z } from "zod";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** Shared by client forms and server actions. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `رمز عبور باید حداقل ${PASSWORD_MIN.toLocaleString("fa-IR")} کاراکتر باشد`)
  .max(PASSWORD_MAX, "رمز عبور بیش از حد طولانی است")
  .refine((v) => /[A-Za-z؀-ۿ]/.test(v) && /[0-9۰-۹]/.test(v), "رمز عبور باید شامل حرف و عدد باشد");
