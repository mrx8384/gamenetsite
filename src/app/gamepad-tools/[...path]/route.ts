import { readFile } from "node:fs/promises";
import { connection, NextResponse } from "next/server";
import { canUseGamepadTester, getGamepadAccess } from "@/features/gamepad-tester/access";
import { resolveToolFile } from "@/features/gamepad-tester/tools-files";
import { getCurrentUser } from "@/lib/auth/dal";

/** PlayStation calibration tool files (embedded in the gamepad tester page), for permitted users only. */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  await connection();
  const access = await getGamepadAccess(await getCurrentUser());
  if (!canUseGamepadTester(access)) return new NextResponse("Forbidden", { status: 403, headers: { "Cache-Control": "private, no-store" } });
  const hit = resolveToolFile((await params).path.map((s) => decodeURIComponent(s)));
  if (!hit) return new NextResponse("Not found", { status: 404 });
  try {
    const body = await readFile(hit.file);
    return new NextResponse(new Uint8Array(body), {
      headers: { "Content-Type": hit.type, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
