import { connection } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/dal";
import { parseCursor } from "@/features/support/schemas";
import { loadMessages } from "@/features/support/service";

/** Staff view of one conversation; viewing marks it read. */
export async function GET(request: Request, { params }: RouteContext<"/api/admin/support/[id]">) {
  await connection();
  const role = (await getSession())?.user.role;
  if (role !== "ADMIN" && role !== "SUPPORT") return Response.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const conv = await db.supportConversation.findUnique({ where: { id }, select: { id: true, status: true, unreadByStaff: true, userLastSeenAt: true } });
  if (!conv) return Response.json({ error: "not found" }, { status: 404 });
  if (conv.unreadByStaff > 0) await db.supportConversation.update({ where: { id }, data: { unreadByStaff: 0 } });
  const messages = await loadMessages(id, { after: parseCursor(new URL(request.url).searchParams.get("after")), staffView: true });
  return Response.json(
    { status: conv.status, userLastSeenAt: conv.userLastSeenAt?.toISOString() ?? null, messages },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
