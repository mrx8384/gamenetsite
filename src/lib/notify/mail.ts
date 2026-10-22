import "server-only";
import { env } from "@/lib/env";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Email sender. Only "log" is implemented until the owner provides an SMTP mailbox
 * (planned: host mailbox on the site domain via nodemailer).
 */
export async function sendMail(message: MailMessage): Promise<void> {
  if (env.MAIL_PROVIDER === "log") {
    console.info(`[mail:log] to=${message.to} subject="${message.subject}"\n${message.text}`);
    return;
  }
  throw new Error("MAIL_PROVIDER=smtp is not configured yet");
}
