import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";
import { siteConfig } from "@/lib/brand";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export class MailError extends Error {}

let transporter: Transporter | null = null;

/** SMTP settings from SMTP_URL (smtp:// or smtps://, credentials URL-encoded) or the separate SMTP_* values. */
export function smtpOptions(e: Pick<typeof env, "SMTP_URL" | "SMTP_HOST" | "SMTP_PORT" | "SMTP_USER" | "SMTP_PASSWORD">) {
  let host = e.SMTP_HOST;
  let port = e.SMTP_PORT;
  let user = e.SMTP_USER;
  let pass = e.SMTP_PASSWORD;
  let secure = port === 465;
  if (e.SMTP_URL) {
    const u = new URL(e.SMTP_URL);
    host = u.hostname;
    secure = u.protocol === "smtps:";
    port = u.port ? Number(u.port) : secure ? 465 : 587;
    user = decodeURIComponent(u.username);
    pass = decodeURIComponent(u.password);
  }
  return {
    host,
    port,
    secure,
    // On 587 insist on STARTTLS so the password never travels in clear text; plain smtp:// URLs on
    // other ports (local relays) are left as configured.
    requireTLS: !secure && port === 587,
    auth: { user, pass },
    // Bounded waits: a slow mail server must not keep sign-up hanging.
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  };
}

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport(smtpOptions(env));
  return transporter;
}

function sender(): string {
  if (env.MAIL_FROM) return env.MAIL_FROM;
  const address = smtpOptions(env).auth.user ?? "";
  return `"${siteConfig.nameFa}" <${address}>`;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Right-to-left HTML version of a plain-text message (Persian reads wrong in left-aligned plain text). */
export function mailHtml(text: string): string {
  const body = escapeHtml(text)
    .split("\n")
    .map((line) => (line.trim() ? `<p style="margin:0 0 10px">${line}</p>` : ""))
    .join("");
  return `<!doctype html><html lang="fa" dir="rtl"><body style="margin:0;padding:24px;background:#FAF9F3"><div dir="rtl" style="max-width:520px;margin:0 auto;padding:24px;background:#fff;border-radius:12px;font-family:Tahoma,Vazirmatn,sans-serif;font-size:15px;line-height:1.9;color:#111;text-align:right">${body}<p style="margin:16px 0 0;color:#777;font-size:12px">${escapeHtml(siteConfig.nameFa)}</p></div></body></html>`;
}

/**
 * Email sender.
 * - "log": prints to the server log instead of sending.
 * - "smtp": sends through the mailbox in SMTP_URL or SMTP_HOST/SMTP_USER/SMTP_PASSWORD.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  if (env.MAIL_PROVIDER === "log") {
    console.info(`[mail:log] to=${message.to} subject="${message.subject}"\n${message.text}`);
    return;
  }
  try {
    await getTransporter().sendMail({ from: sender(), to: message.to, subject: message.subject, text: message.text, html: mailHtml(message.text) });
  } catch (e) {
    // Never log the password; nodemailer's message names the step that failed (connect, auth, recipient).
    const err = e as { code?: string; responseCode?: number; message?: string };
    throw new MailError(`SMTP send failed: ${err.code ?? ""} ${err.responseCode ?? ""} ${err.message ?? String(e)}`.replace(/\s+/g, " ").trim());
  }
}
