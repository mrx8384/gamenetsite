import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ServerDashboard } from "@/components/admin/server/server-dashboard";
import { LoadingRows } from "@/components/ui/states";
import { getLiveSnapshot } from "@/features/server-status/collect";
import { getHistory, getServerDetails } from "@/features/server-status/queries";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "وضعیت سرور" };

/** Server resources (CPU, RAM, disk, network) measured by the site on its own server. ADMIN only. */
export default function ServerStatusPage() {
  return (
    <>
      <AdminPageHeader title="وضعیت سرور" description="مصرف پردازنده، رم، دیسک و شبکهٔ سرور سایت — زنده و در روزهای گذشته. از هر دستگاهی (حتی موبایل) قابل مشاهده است." />
      <Suspense fallback={<LoadingRows rows={6} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await requireRole(["ADMIN"], "/admin/server");
  await connection();
  const [live, details, history] = await Promise.all([getLiveSnapshot(), getServerDetails(), getHistory("24h")]);
  return <ServerDashboard initial={{ live, details, history, fetchedAt: live.takenAt }} />;
}
