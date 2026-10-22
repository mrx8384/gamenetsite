import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "تورنومنت" };

// Placeholder by specification: no tournament management until specs arrive.
export default function AdminTournamentsPage() {
  return (
    <>
      <AdminPageHeader title="تورنومنت" description="مدیریت تورنومنت‌ها پس از دریافت مشخصات کامل اضافه می‌شود." />
      <Suspense fallback={<LoadingRows rows={3} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await requireRole(["ADMIN"], "/admin/tournaments");
  return (
    <EmptyState
      icon={Trophy}
      title="بخش تورنومنت به‌زودی فعال می‌شود."
      description="ساخت تورنومنت، جدول مسابقات و ثبت نتایج هنوز پیاده‌سازی نشده است. متن صفحه‌های تورنومنت و تست دسته را می‌توانید از تنظیمات تغییر دهید."
      action={<Button asChild variant="outline"><Link href="/admin/settings/tournaments">ویرایش متن‌های تورنومنت</Link></Button>}
    />
  );
}
