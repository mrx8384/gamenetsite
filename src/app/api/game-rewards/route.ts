import { connection } from "next/server";
import { json } from "@/atom-world/server/http";
import { getCurrentUser } from "@/lib/auth/dal";
import { rewardsStatus } from "@/features/game-rewards/service";

/** GET → the player's points, cards and the manager's rules for the 3D world (logged out: rules + login link). */
export async function GET() {
  await connection();
  const user = await getCurrentUser();
  return json(await rewardsStatus(user?.id ?? null));
}
