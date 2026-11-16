import type { Metadata } from "next";
import { Suspense } from "react";
import { Pencil, Plus, TicketPercent } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { DiscountDialog } from "@/components/admin/discounts/discount-dialog";
import { toDiscountForm } from "@/components/admin/discounts/discount-form-data";
import { DeleteButton } from "@/components/admin/store/delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteDiscountCode } from "@/features/discounts/admin-actions";
import { describeDiscount, SCOPE_LABELS, type DiscountScope } from "@/features/discounts/rules";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTime, formatNumber, formatToman } from "@/lib/format";

export const metadata: Metadata = { title: "کدهای تخفیف" };

export default function DiscountsPage() {
  return (
    <>
      <AdminPageHeader
        title="کدهای تخفیف"
        description="کد بسازید و به مشتری بدهید؛ در فروشگاه، رزرو و ثبت‌نام تورنومنت قابل استفاده است."
        actions={<DiscountDialog trigger={<Button><Plus /> کد تخفیف جدید</Button>} />}
      />
      <Suspense fallback={<LoadingRows rows={4} />}>
        <DiscountsTable />
      </Suspense>
    </>
  );
}

async function DiscountsTable() {
  await requireRole(["ADMIN"], "/admin/discounts");
  const now = new Date();
  const codes = await db.discountCode.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  if (codes.length === 0) return <EmptyState icon={TicketPercent} title="هنوز کد تخفیفی نساخته‌اید" description="با «کد تخفیف جدید» یک کد درصدی یا مبلغ ثابت بسازید." />;
  const counting = { OR: [{ order: { status: { not: "CANCELLED" as const } } }, { booking: { status: { not: "CANCELLED" as const } } }, { tournamentEntry: { status: { not: "CANCELLED" as const } } }] };
  const usage = await db.discountRedemption.groupBy({ by: ["codeId"], where: { codeId: { in: codes.map((c) => c.id) }, ...counting }, _count: { _all: true }, _sum: { amount: true } });
  const use = new Map(usage.map((u) => [u.codeId, u]));
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>کد</TableHead>
          <TableHead>تخفیف</TableHead>
          <TableHead>بخش‌ها</TableHead>
          <TableHead>اعتبار</TableHead>
          <TableHead>استفاده</TableHead>
          <TableHead>وضعیت</TableHead>
          <TableHead className="w-24"><span className="sr-only">عملیات</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {codes.map((c) => {
          const u = use.get(c.id);
          const expired = c.endsAt !== null && c.endsAt < now;
          return (
            <TableRow key={c.id}>
              <TableCell>
                <p className="ltr font-mono font-bold" dir="ltr">{c.code}</p>
                {c.title ? <p className="text-xs text-muted-foreground">{c.title}</p> : null}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {describeDiscount(c)}
                {c.minAmount > BigInt(0) ? <p className="text-xs text-muted-foreground">حداقل خرید {formatToman(c.minAmount)}</p> : null}
              </TableCell>
              <TableCell className="text-xs">{c.scopes.map((s) => SCOPE_LABELS[s as DiscountScope] ?? s).join("، ")}</TableCell>
              <TableCell className="text-xs">
                {c.startsAt ? <p>از {formatDateTime(c.startsAt)}</p> : null}
                {c.endsAt ? <p>تا {formatDateTime(c.endsAt)}</p> : <p className="text-muted-foreground">بدون تاریخ پایان</p>}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {formatNumber(u?._count._all ?? 0)}{c.usageLimit ? ` از ${formatNumber(c.usageLimit)}` : ""}
                {u?._sum.amount ? <p className="text-xs text-muted-foreground">جمع تخفیف {formatToman(u._sum.amount)}</p> : null}
              </TableCell>
              <TableCell>{!c.isActive ? <Badge variant="outline">غیرفعال</Badge> : expired ? <Badge variant="warning">منقضی</Badge> : <Badge variant="success">فعال</Badge>}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <DiscountDialog
                    initial={toDiscountForm({ ...c, value: c.value.toString(), maxDiscount: c.maxDiscount?.toString() ?? null, minAmount: c.minAmount.toString(), startsAt: c.startsAt?.toISOString() ?? null, endsAt: c.endsAt?.toISOString() ?? null })}
                    trigger={<Button variant="ghost" size="icon-sm" aria-label={`ویرایش ${c.code}`}><Pencil /></Button>}
                  />
                  <DeleteButton title={`حذف کد «${c.code}»؟`} description="اگر قبلاً استفاده شده باشد، فقط غیرفعال می‌شود." action={deleteDiscountCode.bind(null, c.id)} />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
