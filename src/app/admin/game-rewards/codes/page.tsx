import type { Metadata } from "next";
import { Suspense } from "react";
import { Search, Ticket } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdjustPointsForm, RewardCodeActions } from "@/components/admin/game-rewards/code-actions";
import { GameRewardsNav } from "@/components/admin/game-rewards/sub-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CHANNEL_LABEL, codeState, type CodeState, usableInStore } from "@/features/game-rewards/rules";
import { balanceOf, findRedemption } from "@/features/game-rewards/service";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTime, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "بررسی کارت تخفیف" };

const STATE: Record<CodeState, { label: string; variant: "success" | "secondary" | "outline" | "destructive" }> = {
  ACTIVE: { label: "قابل استفاده", variant: "success" },
  USED: { label: "استفاده شده", variant: "secondary" },
  EXPIRED: { label: "منقضی", variant: "outline" },
  CANCELLED: { label: "لغو شده", variant: "destructive" },
};

export default function RewardCodesPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  return (
    <>
      <AdminPageHeader title="دستاوردها و جوایز" description="کد کارتی که بازیکن نشان می‌دهد را وارد کنید تا اعتبارش را ببینید و استفاده را ثبت کنید." />
      <GameRewardsNav current="/admin/game-rewards/codes" />
      <form action="/admin/game-rewards/codes" className="mb-6 flex max-w-xl gap-2" role="search">
        <label htmlFor="code" className="sr-only">
          کد کارت
        </label>
        <Input id="code" name="code" dir="ltr" placeholder="ATOM-XXXX-XXXX" autoComplete="off" className="font-mono" />
        <Button type="submit">
          <Search /> بررسی
        </Button>
      </form>
      <Suspense fallback={<LoadingRows rows={3} />}>
        <Lookup searchParams={searchParams} />
      </Suspense>
      <section className="mt-8 grid gap-3">
        <h2 className="font-bold">اصلاح دستی امتیاز کاربر</h2>
        <AdjustPointsForm />
      </section>
      <section className="mt-8 grid gap-3">
        <h2 className="font-bold">آخرین کارت‌های گرفته‌شده</h2>
        <Suspense fallback={<LoadingRows rows={5} />}>
          <Recent />
        </Suspense>
      </section>
    </>
  );
}

async function Lookup({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  await requireRole(["ADMIN"], "/admin/game-rewards/codes");
  const code = String((await searchParams).code ?? "").slice(0, 40);
  if (!code.trim()) return null;
  const r = await findRedemption(code);
  if (!r) return <EmptyState icon={Ticket} title="کارتی با این کد پیدا نشد" description="کد را دوباره بررسی کنید (حروف انگلیسی، مثل ATOM-AB12-CD34)." />;
  const state = codeState(r);
  const balance = await balanceOf(db, r.userId);
  return (
    <div className="grid gap-4 rounded-xl border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-lg font-bold" dir="ltr">
          {r.code}
        </span>
        <Badge variant={STATE[state].variant}>{STATE[state].label}</Badge>
        <Badge variant="info">{CHANNEL_LABEL[r.channel]}</Badge>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">کارت</dt>
          <dd className="font-medium">
            {r.title} — {formatNumber(r.discountPercent)}٪ تخفیف
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">صاحب کارت</dt>
          <dd className="font-medium">
            {r.user.name}{" "}
            <span className="ltr text-muted-foreground" dir="ltr">
              {r.user.phone ?? r.user.email}
            </span>{" "}
            · امتیاز فعلی {formatNumber(balance)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">گرفته‌شده</dt>
          <dd>
            {formatDateTime(r.createdAt)} با {formatNumber(r.pointsSpent)} امتیاز
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">اعتبار تا</dt>
          <dd>{formatDateTime(r.expiresAt)}</dd>
        </div>
        {r.usedAt ? (
          <div>
            <dt className="text-muted-foreground">استفاده</dt>
            <dd>
              {formatDateTime(r.usedAt)}
              {r.usedBy ? ` — ثبت توسط ${r.usedBy.name}` : ""}
              {r.order ? ` — سفارش ${r.order.number}` : ""}
            </dd>
          </div>
        ) : null}
      </dl>
      {state === "ACTIVE" ? <RewardCodeActions code={r.code} canUseInStore={usableInStore(r.channel)} /> : null}
      {state === "ACTIVE" && !usableInStore(r.channel) ? <p className="text-sm text-muted-foreground">این کارت فقط در فروشگاه آنلاین قابل استفاده است.</p> : null}
    </div>
  );
}

async function Recent() {
  await requireRole(["ADMIN"], "/admin/game-rewards/codes");
  const rows = await db.rewardRedemption.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { user: { select: { name: true } } } });
  if (rows.length === 0) return <EmptyState icon={Ticket} title="هنوز کسی کارتی نگرفته" description="کارت‌هایی که بازیکن‌ها در دنیای سه‌بعدی می‌گیرند اینجا دیده می‌شوند." />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>کد</TableHead>
          <TableHead>کاربر</TableHead>
          <TableHead>کارت</TableHead>
          <TableHead>تاریخ</TableHead>
          <TableHead>وضعیت</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const s = codeState(r);
          return (
            <TableRow key={r.id}>
              <TableCell>
                <a className="font-mono text-link underline-offset-2 hover:underline" dir="ltr" href={`/admin/game-rewards/codes?code=${encodeURIComponent(r.code)}`}>
                  {r.code}
                </a>
              </TableCell>
              <TableCell>{r.user.name}</TableCell>
              <TableCell>
                {r.title} ({formatNumber(r.discountPercent)}٪)
              </TableCell>
              <TableCell className="whitespace-nowrap">{formatDateTime(r.createdAt)}</TableCell>
              <TableCell>
                <Badge variant={STATE[s].variant}>{STATE[s].label}</Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
