import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once at first import.
 * Never expose these values to the client (no NEXT_PUBLIC_ prefix for secrets).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url().refine((v) => v.startsWith("postgres"), "DATABASE_URL must be a PostgreSQL URL"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  APP_URL: z.url(),
  UPLOAD_DIR: z.string().min(1).default("./storage/uploads"),

  // Optional integrations — features stay disabled until configured.
  PAYMENT_PROVIDER: z.enum(["disabled", "zarinpal"]).default("disabled"),
  PAYMENT_MERCHANT_ID: z.string().optional(),
  SMS_PROVIDER: z.enum(["log", "kavenegar", "smsir"]).default("log"),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER: z.string().optional(),
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
  if (env.NODE_ENV === "production") {
    if (env.SMS_PROVIDER === "log") console.warn("[env] SMS_PROVIDER=log in production: SMS will not be sent.");
    if (env.MAIL_PROVIDER === "log") console.warn("[env] MAIL_PROVIDER=log in production: emails will not be sent.");
  }
  return env;
}

export const env = loadEnv();
