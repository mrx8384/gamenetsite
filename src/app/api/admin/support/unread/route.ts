import { connection } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/dal";

/** Number of conversations waiting for staff (badge + sound in the admin panel). */
export async function GET() {
  await connection();
  const role = (await getSession())?.user.role;
  if (role !== "ADMIN" && role !== "SUPPORT") return Response.json({ error: "forbidden" }, { status: 403 });
  const count = await db.supportConversation.count({ where: { unreadByStaff: { gt: 0 } } });
  return Response.json({ count }, { headers: { "Cache-Control": "private, no-store" } });
}
