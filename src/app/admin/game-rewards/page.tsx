import type { Metadata } from "next";
import { Suspense } from "react";
import { ACHIEVEMENTS } from "@/atom-world/minigames/achievementList";
import { AdminPageHeader } from "@/components/admin/page-header";
import { GameRewardsNav } from "@/components/admin/game-rewards/sub-nav";
import { type AchievementRow, RewardRulesForm } from "@/components/admin/game-rewards/rules-form";
import { LoadingRows } from "@/components/ui/states";
import { GAME_NAMES } from "@/features/game-rewards/rules";
import { getRules } from "@/features/game-rewards/service";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "دستاوردها و جوایز" };

export default function GameRewardsPage() {
  return (
    <>
      <AdminPageHeader title="دستاوردها و جوایز" description="امتیاز بازی‌های دنیای سه‌بعدی، دستاوردها و کارت‌های تخفیفی که بازیکن‌ها با امتیاز می‌گیرند." />
      <GameRewardsNav current="/admin/game-rewards" />
      <Suspense fallback={<LoadingRows rows={6} />}>
        <Rules />
      </Suspense>
    </>
  );
}

async function Rules() {
  await requireRole(["ADMIN"], "/admin/game-rewards");
  const [rules, players, earned, issued, used] = await Promise.all([
    getRules(),
    db.gamePointsEntry.groupBy({ by: ["userId"] }).then((r) => r.length),
    db.gamePointsEntry.aggregate({ where: { amount: { gt: 0 }, kind: { in: ["ROUND", "ACHIEVEMENT"] } }, _sum: { amount: true } }),
    db.rewardRedemption.count({ where: { status: { not: "CANCELLED" } } }),
    db.rewardRedemption.count({ where: { status: "USED" } }),
  ]);
  const gameName = (g: string | null) => (g ? (GAME_NAMES[g] ?? g) : "🌍 همهٔ دنیای اتم");
  const rows: AchievementRow[] = ACHIEVEMENTS.map((a) => ({ id: a.id, emoji: a.emoji, title: a.title, hint: a.hint, hidden: !!a.hidden, defaultPoints: a.points, game: gameName(a.game) }));
  const stats = [
    ["بازیکن با امتیاز", players],
    ["امتیاز داده‌شده", earned._sum.amount ?? 0],
    ["کارت گرفته‌شده", issued],
    ["کارت استفاده‌شده", used],
  ] as const;
  return (
    <div className="grid gap-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, n]) => (
          <div key={label} className="rounded-xl border bg-surface p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-xl font-black">{formatNumber(n)}</dd>
          </div>
        ))}
      </dl>
      <RewardRulesForm rules={rules} achievements={rows} />
    </div>
  );
}
