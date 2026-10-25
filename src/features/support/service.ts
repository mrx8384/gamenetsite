import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/notify/mail";
import { sendTemplateSms } from "@/lib/notify/sms";
import { getSiteSettings } from "@/features/settings/site";
import { NOTIFY_THROTTLE_MS, SUPPORT_HISTORY_LIMIT, USER_ONLINE_WINDOW_MS, type ChatMessage } from "./constants";

const MOBILE_RE = /^09\d{9}$/;

/**
 * Messages of a conversation. With `after`, returns messages at or after that time (the client
 * de-duplicates by id, so equal timestamps are never lost); otherwise the latest history.
 */
export async function loadMessages(conversationId: string, opts: { after?: Date; staffView: boolean }): Promise<ChatMessage[]> {
  const rows = opts.after
    ? await db.supportMessage.findMany({
        where: { conversationId, createdAt: { gte: opts.after } },
        orderBy: { createdAt: "asc" },
        take: SUPPORT_HISTORY_LIMIT,
        include: { sender: { select: { name: true } } },
      })
    : (
        await db.supportMessage.findMany({
          where: { conversationId },
          orderBy: { createdAt: "desc" },
          take: SUPPORT_HISTORY_LIMIT,
          include: { sender: { select: { name: true } } },
        })
      ).reverse();
  return rows.map((m) => ({
    id: m.id,
    body: m.body,
    fromStaff: m.fromStaff,
    senderName: opts.staffView && m.fromStaff ? (m.sender?.name ?? "پشتیبان") : null,
    createdAt: m.createdAt.toISOString(),
  }));
}

/** Claims the notification slot atomically so two parallel requests can't both send. */
async function claim(conversationId: string, field: "staffNotifiedAt" | "customerNotifiedAt"): Promise<boolean> {
  const before = new Date(Date.now() - NOTIFY_THROTTLE_MS);
  const now = new Date();
  const { count } =
    field === "staffNotifiedAt"
      ? await db.supportConversation.updateMany({
          where: { id: conversationId, OR: [{ staffNotifiedAt: null }, { staffNotifiedAt: { lt: before } }] },
          data: { staffNotifiedAt: now },
        })
      : await db.supportConversation.updateMany({
          where: { id: conversationId, OR: [{ customerNotifiedAt: null }, { customerNotifiedAt: { lt: before } }] },
          data: { customerNotifiedAt: now },
        });
  return count === 1;
}

const smsName = (name: string) => name.replace(/\s+/g, " ").trim().slice(0, 20) || "کاربر";

/** SMS to the number set in Admin → تنظیمات سایت → پشتیبانی آنلاین (throttled per conversation). */
export async function notifyStaff(conversationId: string, userName: string): Promise<void> {
  const { notifyMobile } = await getSiteSettings("support");
  const templateId = env.SMS_SUPPORT_STAFF_TEMPLATE_ID;
  if (!MOBILE_RE.test(notifyMobile)) return;
  if (!templateId && env.SMS_PROVIDER !== "log") return;
  if (!(await claim(conversationId, "staffNotifiedAt"))) return;
  await sendTemplateSms(notifyMobile, templateId ?? 0, [{ name: "NAME", value: smsName(userName) }]);
}

/** Tells the customer about a reply by SMS (mobile) or email, only if they are not on the site right now. */
export async function notifyCustomer(conversationId: string): Promise<void> {
  const conv = await db.supportConversation.findUnique({
    where: { id: conversationId },
    select: { userLastSeenAt: true, user: { select: { name: true, phone: true, email: true, isActive: true } } },
  });
  if (!conv || !conv.user.isActive) return;
  if (conv.userLastSeenAt && Date.now() - conv.userLastSeenAt.getTime() < USER_ONLINE_WINDOW_MS) return;

  const { phone, email, name } = conv.user;
  const templateId = env.SMS_SUPPORT_REPLY_TEMPLATE_ID;
  const canSms = !!phone && (!!templateId || env.SMS_PROVIDER === "log");
  if (!canSms && !email) return;
  if (!(await claim(conversationId, "customerNotifiedAt"))) return;

  if (canSms) {
    await sendTemplateSms(phone!, templateId ?? 0, [{ name: "NAME", value: smsName(name) }]);
  } else {
    await sendMail({
      to: email!,
      subject: "پاسخ پشتیبانی آتم گیم کلاب",
      text: `${name} عزیز،\n\nبه پیام شما در پشتیبانی آنلاین آتم گیم کلاب پاسخ داده شد.\nبرای دیدن پاسخ وارد سایت شوید:\n${env.APP_URL}/?support=open\n\nآتم گیم کلاب`,
    });
  }
}

/** Runs a notification without failing the user's action. */
export function safely(task: () => Promise<void>, label: string) {
  return task().catch((e: unknown) => console.error(`[support] ${label} failed:`, e instanceof Error ? e.message : e));
}
