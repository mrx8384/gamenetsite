import type { Metadata } from "next";
import { Suspense } from "react";
import { SectionsForm } from "@/components/admin/settings/sections-form";
import { LoadingRows } from "@/components/ui/states";
import { getSectionVisibility } from "@/features/settings/sections";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "نمایش بخش‌ها" };

export default function SectionsSettingsPage() {
  return (
    <>
      <p className="mb-4 text-sm leading-7 text-muted-foreground">
        هر بخشی را که فعلاً نمی‌خواهید کاربران ببینند مخفی کنید: از منوها، صفحهٔ اصلی و نقشهٔ سایت برداشته می‌شود و آدرسش برای کاربران «صفحه پیدا نشد» نشان می‌دهد.
        اطلاعات آن بخش پاک نمی‌شود و شما (مدیر) همچنان آن را می‌بینید؛ هر وقت خواستید دوباره روشنش کنید.
      </p>
      <Suspense fallback={<LoadingRows rows={8} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await requireRole(["ADMIN"], "/admin/settings/sections");
  return <SectionsForm initial={await getSectionVisibility()} />;
}
