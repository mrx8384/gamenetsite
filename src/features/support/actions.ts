"use server";

import { after } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, assertUser, AuthorizationError } from "@/lib/auth/dal";
import { fail, ok, RATE_LIMIT_ERROR, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { SUPPORT_STAFF_ROLES, type ChatMessage } from "./constants";
import { messageBodySchema } from "./schemas";
import { notifyCustomer, notifyStaff, safely } from "./service";

async function session() {
  try {
    return await assertUser();
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

async function staff() {
  try {
    return (await assertRole([...SUPPORT_STAFF_ROLES])).user;
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

const toChat = (m: { id: string; body: string; fromStaff: boolean; createdAt: Date }, senderName: string | null): ChatMessage => ({
  id: m.id,
  body: m.body,
  fromStaff: m.fromStaff,
  senderName,
  createdAt: m.createdAt.toISOString(),
});

/** Customer → support. Creates the conversation on first use and reopens a closed one. */
export async function sendSupportMessage(body: unknown): Promise<ActionResult<ChatMessage>> {
  const s = await session();
  if (!s) return fail("برای ارسال پیام وارد حساب کاربری شوید.");
  const parsed = messageBodySchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "پیام نامعتبر است.");

  const [minute, day] = await Promise.all([
    rateLimit(`support:msg:min:${s.user.id}`, 8, 60),
    rateLimit(`support:msg:day:${s.user.id}`, 200, 86_400),
  ]);
  if (!minute.allowed || !day.allowed) return fail(RATE_LIMIT_ERROR);

  const now = new Date();
  const message = await db.$transaction(async (tx) => {
    const conv = await tx.supportConversation.upsert({
      where: { userId: s.user.id },
      create: { userId: s.user.id, lastMessageAt: now, unreadByStaff: 1, userLastSeenAt: now },
      update: { status: "OPEN", lastMessageAt: now, unreadByStaff: { increment: 1 }, userLastSeenAt: now },
      select: { id: true },
    });
    return tx.supportMessage.create({ data: { conversationId: conv.id, senderId: s.user.id, fromStaff: false, body: parsed.data } });
  });

  const userName = s.user.name;
  after(() => safely(() => notifyStaff(message.conversationId, userName), "notify staff"));
  return ok(toChat(message, null));
}

/** Staff → customer. */
export async function replySupport(conversationId: unknown, body: unknown): Promise<ActionResult<ChatMessage>> {
  const user = await staff();
  if (!user) return fail("دسترسی غیرمجاز.");
  if (typeof conversationId !== "string" || conversationId.length > 40) return fail("گفت‌وگو پیدا نشد.");
  const parsed = messageBodySchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "پیام نامعتبر است.");
  const limit = await rateLimit(`support:reply:${user.id}`, 60, 60);
  if (!limit.allowed) return fail(RATE_LIMIT_ERROR);

  const now = new Date();
  const message = await db.$transaction(async (tx) => {
    const { count } = await tx.supportConversation.updateMany({
      where: { id: conversationId },
      // Replying means staff has read the thread; the customer gets one more unread message.
      data: { status: "OPEN", lastMessageAt: now, unreadByStaff: 0, unreadByUser: { increment: 1 } },
    });
    if (!count) return null;
    return tx.supportMessage.create({ data: { conversationId, senderId: user.id, fromStaff: true, body: parsed.data } });
  });
  if (!message) return fail("گفت‌وگو پیدا نشد.");

  after(() => safely(() => notifyCustomer(conversationId), "notify customer"));
  return ok(toChat(message, user.name));
}

export async function setSupportStatus(conversationId: unknown, status: unknown): Promise<ActionResult<undefined>> {
  const user = await staff();
  if (!user) return fail("دسترسی غیرمجاز.");
  if (typeof conversationId !== "string" || (status !== "OPEN" && status !== "CLOSED")) return fail("درخواست نامعتبر است.");
  const { count } = await db.supportConversation.updateMany({
    where: { id: conversationId },
    data: { status, ...(status === "CLOSED" ? { unreadByStaff: 0 } : {}) },
  });
  if (!count) return fail("گفت‌وگو پیدا نشد.");
  await audit({ actorId: user.id, action: status === "CLOSED" ? "support.closed" : "support.reopened", entity: "support_conversation", entityId: conversationId });
  return ok(undefined, status === "CLOSED" ? "گفت‌وگو بسته شد." : "گفت‌وگو دوباره باز شد.");
}
