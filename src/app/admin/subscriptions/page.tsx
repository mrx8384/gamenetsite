import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Pencil, Plus, Repeat } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { DeleteButton } from "@/components/admin/store/delete-button";
import { PlanDialog } from "@/components/admin/subscriptions/plan-dialog";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deletePlan } from "@/features/subscriptions/admin-actions";
import { ENTITLEMENTS, SUBSCRIPTION_STATUS_LABELS, type EntitlementKey } from "@/features/subscriptions/constants";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDate, formatNumber, formatToman } from "@/lib/format";

export const metadata: Metadata = { title: "اشتراک‌ها" };

export default function SubscriptionsPage() {
  return (
    <>
      <AdminPageHeader
        title="اشتراک‌ها"
        description="تعریف اشتراک‌های همکاران و امکاناتی که هر اشتراک فعال می‌کند."
        actions={<PlanDialog trigger={<Button><Plus /> اشتراک جدید</Button>} />}
      />
      <Alert variant="warning" className="mb-6">
        خرید اشتراک فعلاً غیرفعال است. اشتراک‌ها فقط تعریف و (در صورت انتخاب) با برچسب «به‌زودی» نمایش داده می‌شوند. فعال‌سازی خرید پس از تأیید شما و راه‌اندازی درگاه پرداخت انجام می‌شود.
      </Alert>
      <Suspense fallback={<LoadingRows rows={5} />}>
        <SubscriptionsContent />
      </Suspense>
    </>
  );
}

async function SubscriptionsContent() {
  await requireRole(["ADMIN"], "/admin/subscriptions");
  const [plans, subs] = await Promise.all([
    db.subscriptionPlan.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { _count: { select: { subscriptions: true } } } }),
    db.partnerSubscription.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { plan: { select: { name: true } }, partner: { select: { id: true, businessName: true } } } }),
  ]);
  return (
    <div className="space-y-6">
      {plans.length === 0 ? (
        <EmptyState icon={Repeat} title="هنوز اشتراکی تعریف نشده" description="اشتراک‌ها را از همین حالا تعریف کنید؛ خرید بعداً فعال می‌شود." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>نام</TableHead>
              <TableHead>قیمت</TableHead>
              <TableHead>مدت</TableHead>
              <TableHead>امکانات</TableHead>
              <TableHead>نمایش</TableHead>
              <TableHead>خرید</TableHead>
              <TableHead className="w-24"><span className="sr-only">عملیات</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <p className="font-medium">{p.name}</p>
                  <p className="ltr text-start text-xs text-muted-foreground">{p.code}</p>
                </TableCell>
                <TableCell className="whitespace-nowrap">{p.price === BigInt(0) ? "رایگان" : formatToman(p.price)}</TableCell>
                <TableCell>{formatNumber(p.durationDays)} روز</TableCell>
                <TableCell className="text-sm">{p.features.length ? p.features.map((f) => ENTITLEMENTS[f as EntitlementKey] ?? f).join("، ") : "—"}</TableCell>
                <TableCell>{p.isVisible ? <Badge variant="info">نمایش «به‌زودی»</Badge> : <Badge variant="outline">مخفی</Badge>}</TableCell>
                <TableCell><Badge variant="outline">غیرفعال</Badge></TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <PlanDialog
                      plan={{ id: p.id, code: p.code, name: p.name, description: p.description ?? "", priceToman: (p.price / BigInt(10)).toString(), durationDays: String(p.durationDays), features: p.features.filter((f): f is EntitlementKey => f in ENTITLEMENTS), isVisible: p.isVisible, sortOrder: String(p.sortOrder) }}
                      trigger={<Button variant="ghost" size="icon-sm" aria-label={`ویرایش ${p.name}`}><Pencil /></Button>}
                    />
                    <DeleteButton title={`حذف «${p.name}»؟`} description={p._count.subscriptions ? "این اشتراک سابقهٔ استفاده دارد و حذف نمی‌شود." : "این اشتراک حذف می‌شود."} action={deletePlan.bind(null, p.id)} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Card>
        <CardHeader><CardTitle>اشتراک‌های همکاران</CardTitle></CardHeader>
        <CardContent>
          {subs.length === 0 ? (
            <p className="text-sm text-muted-foreground">هنوز هیچ همکاری اشتراک ندارد.</p>
          ) : (
            <ul className="divide-y text-sm">
              {subs.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/admin/partners/${s.partner.id}`} className="text-link hover:underline">{s.partner.businessName}</Link>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {s.plan.name}
                    {s.endsAt ? ` · تا ${formatDate(s.endsAt)}` : null}
                    <Badge variant={s.status === "ACTIVE" ? "success" : "outline"}>{SUBSCRIPTION_STATUS_LABELS[s.status]}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
