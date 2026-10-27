import type { Metadata } from "next";
import { Suspense } from "react";
import { Pencil, Plus, Ticket } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { RewardCardDialog } from "@/components/admin/game-rewards/card-dialog";
import { GameRewardsNav } from "@/components/admin/game-rewards/sub-nav";
import { DeleteButton } from "@/components/admin/store/delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteRewardCard } from "@/features/game-rewards/admin-actions";
import { CHANNEL_LABEL } from "@/features/game-rewards/rules";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "کارت‌های تخفیف" };

export default function RewardCardsPage() {
  return (
    <>
      <AdminPageHeader
        title="دستاوردها و جوایز"
        description="کارت‌هایی که بازیکن‌ها با امتیاز دنیای سه‌بعدی می‌گیرند: امتیاز لازم، درصد تخفیف، محل استفاده و مدت اعتبار."
        actions={
          <RewardCardDialog
            trigger={
              <Button>
                <Plus /> کارت جدید
              </Button>
            }
          />
        }
      />
      <GameRewardsNav current="/admin/game-rewards/cards" />
      <Suspense fallback={<LoadingRows rows={4} />}>
        <CardsTable />
      </Suspense>
    </>
  );
}

async function CardsTable() {
  await requireRole(["ADMIN"], "/admin/game-rewards/cards");
  const cards = await db.rewardCard.findMany({
    orderBy: [{ sortOrder: "asc" }, { pointsCost: "asc" }],
    include: { _count: { select: { redemptions: true } } },
  });
  if (cards.length === 0) {
    return <EmptyState icon={Ticket} title="هنوز کارتی تعریف نشده" description="مثلاً «کارت تخفیف ۱۰٪» با ۱۰۰۰ امتیاز. تا کارتی نباشد، بازیکن‌ها فقط امتیاز جمع می‌کنند." />;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>کارت</TableHead>
          <TableHead>امتیاز</TableHead>
          <TableHead>تخفیف</TableHead>
          <TableHead>محل استفاده</TableHead>
          <TableHead>اعتبار</TableHead>
          <TableHead>گرفته‌شده</TableHead>
          <TableHead>وضعیت</TableHead>
          <TableHead className="w-24">
            <span className="sr-only">عملیات</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cards.map((c) => (
          <TableRow key={c.id}>
            <TableCell>
              <p className="font-medium">{c.title}</p>
              {c.description ? <p className="text-xs text-muted-foreground">{c.description}</p> : null}
            </TableCell>
            <TableCell>{formatNumber(c.pointsCost)}</TableCell>
            <TableCell>{formatNumber(c.discountPercent)}٪</TableCell>
            <TableCell>
              <Badge variant={c.channel === "IN_STORE" ? "info" : c.channel === "ONLINE" ? "secondary" : "accent"}>{CHANNEL_LABEL[c.channel]}</Badge>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {formatNumber(c.validDays)} روز
              {c.limitPer30Days > 0 ? <p className="text-xs text-muted-foreground">هر نفر {formatNumber(c.limitPer30Days)} بار در ۳۰ روز</p> : null}
            </TableCell>
            <TableCell>{formatNumber(c._count.redemptions)}</TableCell>
            <TableCell>{c.isActive ? <Badge variant="success">فعال</Badge> : <Badge variant="outline">غیرفعال</Badge>}</TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <RewardCardDialog
                  card={{
                    id: c.id,
                    title: c.title,
                    description: c.description,
                    pointsCost: String(c.pointsCost),
                    discountPercent: String(c.discountPercent),
                    channel: c.channel,
                    validDays: String(c.validDays),
                    limitPer30Days: String(c.limitPer30Days),
                    isActive: c.isActive,
                    sortOrder: String(c.sortOrder),
                  }}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`ویرایش ${c.title}`}>
                      <Pencil />
                    </Button>
                  }
                />
                <DeleteButton title={`حذف «${c.title}»؟`} description="کارت‌هایی که بازیکن‌ها قبلاً گرفته‌اند معتبر می‌مانند." action={deleteRewardCard.bind(null, c.id)} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
