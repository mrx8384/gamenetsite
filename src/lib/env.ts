import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once at first import.
 * Never expose these values to the client (no NEXT_PUBLIC_ prefix for secrets).
 */
/** Treat empty strings from .env files as "not set". */
const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url().refine((v) => v.startsWith("postgres"), "DATABASE_URL must be a PostgreSQL URL"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  APP_URL: z.url(),
  UPLOAD_DIR: z.string().min(1).default("./storage/uploads"),

  // Optional integrations — features stay disabled until configured.
  /** "sandbox" is a local test gateway and is refused in production. Real providers are added when credentials arrive. */
  PAYMENT_PROVIDER: z.enum(["disabled", "sandbox"]).default("disabled"),
  PAYMENT_MERCHANT_ID: z.string().optional(),
  SMS_PROVIDER: z.enum(["log", "smsir"]).default("log"),
  SMS_API_KEY: z.string().optional(),
  /** SMS.ir "verify" template ID (created and approved in the SMS.ir panel). */
  SMS_TEMPLATE_ID: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
  /** Template variable name that receives the code, e.g. #CODE# → "CODE". */
  SMS_TEMPLATE_PARAM: z.string().default("CODE"),
  MAIL_PROVIDER: z.enum(["log", "smtp"]).default("log"),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production" && env.PAYMENT_PROVIDER === "sandbox") {
    throw new Error("PAYMENT_PROVIDER=sandbox is for development only");
  }
  if (env.SMS_PROVIDER === "smsir" && (!env.SMS_API_KEY || !env.SMS_TEMPLATE_ID)) {
    throw new Error("SMS_PROVIDER=smsir requires SMS_API_KEY and SMS_TEMPLATE_ID");
  }
  if (env.NODE_ENV === "production") {
    if (env.SMS_PROVIDER === "log") console.warn("[env] SMS_PROVIDER=log in production: SMS will not be sent.");
    if (env.MAIL_PROVIDER === "log") console.warn("[env] MAIL_PROVIDER=log in production: emails will not be sent.");
  }
  return env;
}

export const env = loadEnv();
