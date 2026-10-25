import { connection } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/dal";
import { parseCursor } from "@/features/support/schemas";
import { loadMessages } from "@/features/support/service";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Customer chat state, polled by the widget.
 * `?open=1` (chat window open) returns messages and marks staff replies as read; `after` = last seen timestamp.
 */
export async function GET(request: Request) {
  await connection();
  const session = await getSession();
  if (!session) return Response.json({ auth: false }, { headers: NO_STORE });

  const url = new URL(request.url);
  const open = url.searchParams.get("open") === "1";
  const after = parseCursor(url.searchParams.get("after"));

  const conv = await db.supportConversation.findUnique({ where: { userId: session.user.id }, select: { id: true, status: true, unreadByUser: true } });
  if (!conv) return Response.json({ auth: true, status: null, unread: 0, messages: [] }, { headers: NO_STORE });

  await db.supportConversation.update({
    where: { id: conv.id },
    data: { userLastSeenAt: new Date(), ...(open && conv.unreadByUser > 0 ? { unreadByUser: 0 } : {}) },
  });
  const messages = open ? await loadMessages(conv.id, { after, staffView: false }) : [];
  return Response.json({ auth: true, status: conv.status, unread: open ? 0 : conv.unreadByUser, messages }, { headers: NO_STORE });
}
