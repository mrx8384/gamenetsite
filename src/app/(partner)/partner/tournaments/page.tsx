import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ManagedTournamentList } from "@/components/tournaments/manage/pages";
import { Alert } from "@/components/ui/alert";
import { LoadingRows } from "@/components/ui/states";
import { canCreateTournament } from "@/features/tournaments/permissions";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "تورنومنت‌های من", robots: { index: false } };

export default function PartnerTournamentsPage() {
  return (
    <>
      <Link href="/partner" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> پنل همکار
      </Link>
      <h1 className="mb-6 text-3xl font-black">تورنومنت‌های من</h1>
      <Suspense fallback={<LoadingRows rows={4} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const user = await requireUser("/partner/tournaments");
  if (user.role === "ADMIN") {
    return <Alert variant="info">مدیران تورنومنت‌ها را از <Link className="text-link underline" href="/admin/tournaments">پنل مدیریت ← تورنومنت‌ها</Link> مدیریت می‌کنند.</Alert>;
  }
  if (user.role !== "PARTNER") {
    return <Alert variant="info">برگزاری تورنومنت مخصوص همکاران تأییدشده است. از <Link className="text-link underline" href="/partner">پنل همکار</Link> درخواست همکاری بدهید.</Alert>;
  }
  const canCreate = await canCreateTournament(user);
  return (
    <div className="space-y-4">
      {!canCreate ? (
        <Alert variant="warning">برای ساخت تورنومنت جدید، اشتراکی با امکان «برگزاری تورنومنت» لازم است. تورنومنت‌های قبلی شما همچنان قابل مدیریت هستند.</Alert>
      ) : null}
      <ManagedTournamentList user={user} basePath="/partner/tournaments" canCreate={canCreate} />
    </div>
  );
}
