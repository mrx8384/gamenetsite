import type { Metadata } from "next";
import { Suspense } from "react";
import { CommerceSettingsForm } from "@/components/admin/orders/commerce-settings-form";
import { FeaturedOrder } from "@/components/admin/store/featured-order";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingRows } from "@/components/ui/states";
import { getPaymentProvider } from "@/features/payments";
import { getCommerceSettings } from "@/features/settings/commerce";
import { FEATURED_ON_HOME } from "@/features/store/queries";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "تنظیمات فروش" };

export default function SettingsPage() {
  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">باز و بسته کردن فروش آنلاین، شمارهٔ استعلام قیمت و ترتیب محصولات منتخب صفحهٔ اصلی. هزینهٔ ارسال در «روش‌های ارسال» تعیین می‌شود.</p>
      <Suspense fallback={<LoadingRows rows={4} />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}

async function SettingsContent() {
  await requireRole(["ADMIN"], "/admin/settings");
  const [s, featured] = await Promise.all([
    getCommerceSettings(),
    db.product.findMany({
      where: { isFeatured: true, status: { not: "ARCHIVED" } },
      orderBy: [{ featuredSort: "asc" }, { updatedAt: "desc" }],
      select: { id: true, title: true, status: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { media: { select: { storageKey: true } } } } },
    }),
  ]);
  const provider = getPaymentProvider();
  return (
    <div className="space-y-6">
      <CommerceSettingsForm
        gatewayLabel={provider?.label ?? null}
        initial={{ salesEnabled: s.salesEnabled, priceInquiryPhone: s.priceInquiryPhone }}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ترتیب محصولات منتخب صفحهٔ اصلی</CardTitle>
          <p className="text-sm text-muted-foreground">{`با فلش‌ها ترتیب را عوض کنید؛ ${FEATURED_ON_HOME.toLocaleString("fa-IR")} محصول فعال اول در صفحهٔ اصلی نمایش داده می‌شوند.`}</p>
        </CardHeader>
        <CardContent>
          <FeaturedOrder
            shown={FEATURED_ON_HOME}
            products={featured.map((p) => ({ id: p.id, title: p.title, active: p.status === "ACTIVE", imageKey: p.images[0]?.media.storageKey ?? null }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
