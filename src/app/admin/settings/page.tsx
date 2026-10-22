import type { Metadata } from "next";
import { Suspense } from "react";
import { CommerceSettingsForm } from "@/components/admin/orders/commerce-settings-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { LoadingRows } from "@/components/ui/states";
import { getPaymentProvider } from "@/features/payments";
import { getCommerceSettings } from "@/features/settings/commerce";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "تنظیمات فروش" };

export default function SettingsPage() {
  return (
    <>
      <AdminPageHeader title="تنظیمات فروش" description="باز و بسته کردن فروش آنلاین، هزینهٔ ارسال و شمارهٔ استعلام قیمت. (سایر تنظیمات سایت در فاز ۸ اضافه می‌شود.)" />
      <Suspense fallback={<LoadingRows rows={4} />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}

async function SettingsContent() {
  await requireRole(["ADMIN"], "/admin/settings");
  const s = await getCommerceSettings();
  const provider = getPaymentProvider();
  return (
    <CommerceSettingsForm
      gatewayLabel={provider?.label ?? null}
      initial={{ salesEnabled: s.salesEnabled, shippingCostToman: (BigInt(s.shippingCost) / BigInt(10)).toString(), priceInquiryPhone: s.priceInquiryPhone }}
    />
  );
}
