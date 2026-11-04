import { timingSafeEqual } from "node:crypto";
import { connection, NextResponse, type NextRequest } from "next/server";
import { getPaymentProviderByKey } from "@/features/payments";
import { webhookSecret } from "@/features/payments/providers/bale/api";
import { handleBaleUpdate, type BaleUpdate } from "@/features/payments/providers/bale/updates";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Bale bot webhook (registered with `pnpm bale:webhook`). The secret path segment is derived from the bot
 * token, so only Bale (which knows the URL) can post here. Always answers 200 for valid calls so Bale
 * doesn't retry; failures are logged.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ secret: string }> }) {
  await connection();
  const { secret } = await params;
  if (!getPaymentProviderByKey("bale") || !same(secret, webhookSecret())) return new NextResponse(null, { status: 404 });
  let update: BaleUpdate;
  try {
    update = (await req.json()) as BaleUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }
  try {
    await handleBaleUpdate(update);
  } catch (e) {
    console.error("[bale] update failed:", e instanceof Error ? e.message : e);
  }
  return NextResponse.json({ ok: true });
}
