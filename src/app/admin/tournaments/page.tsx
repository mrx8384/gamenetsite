import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ManagedTournamentList } from "@/components/tournaments/manage/pages";
import { LoadingRows } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "تورنومنت‌ها" };

export default function AdminTournamentsPage() {
  return (
    <>
      <AdminPageHeader title="تورنومنت‌ها" description="ساخت تورنومنت، ثبت‌نام، جدول مسابقات و ثبت نتایج. تورنومنت‌های همکاران هم این‌جا دیده می‌شوند." />
      <Suspense fallback={<LoadingRows rows={4} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const user = await requireRole(["ADMIN"], "/admin/tournaments");
  return <ManagedTournamentList user={user} basePath="/admin/tournaments" canCreate />;
}
