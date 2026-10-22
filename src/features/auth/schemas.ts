import { z } from "zod";
import { passwordSchema } from "@/lib/auth/password-policy";
import { parseIdentifier } from "@/lib/identifiers";
import { toEnglishDigits } from "@/lib/format";

/** "Email or mobile" field: validated here, parsed again on the server with parseIdentifier(). */
export const identifierSchema = z
  .string()
  .trim()
  .min(1, "ایمیل یا شمارهٔ موبایل را وارد کنید")
  .refine((v) => parseIdentifier(v) !== null, "ایمیل یا شمارهٔ موبایل معتبر نیست");

export const codeSchema = z
  .string()
  .transform((v) => toEnglishDigits(v).replace(/\s/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, "کد ۶ رقمی را وارد کنید"));

export const nameSchema = z.string().trim().min(2, "نام باید حداقل ۲ حرف باشد").max(100, "نام بیش از حد طولانی است");

export const loginPasswordSchema = z.object({
  identifier: identifierSchema,
  password: z.string().min(1, "رمز عبور را وارد کنید").max(128),
  next: z.string().optional(),
});

export const requestCodeSchema = z.object({ identifier: identifierSchema });

export const loginCodeSchema = z.object({ identifier: identifierSchema, code: codeSchema, next: z.string().optional() });

export const registerStartSchema = z.object({ name: nameSchema, identifier: identifierSchema, password: passwordSchema });

export const registerCompleteSchema = registerStartSchema.extend({ code: codeSchema });

export const resetPasswordSchema = z.object({ identifier: identifierSchema, code: codeSchema, password: passwordSchema });

export const profileSchema = z.object({ name: nameSchema });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "رمز عبور فعلی را وارد کنید").max(128),
  newPassword: passwordSchema,
});

export const contactChangeSchema = z.object({ identifier: identifierSchema });
export const contactConfirmSchema = z.object({ identifier: identifierSchema, code: codeSchema });
