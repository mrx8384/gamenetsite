import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NewTournament } from "@/components/tournaments/manage/pages";
import { Alert } from "@/components/ui/alert";
import { LoadingRows } from "@/components/ui/states";
import { canCreateTournament } from "@/features/tournaments/permissions";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "تورنومنت جدید", robots: { index: false } };

export default function PartnerNewTournamentPage() {
  return (
    <>
      <Link href="/partner/tournaments" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> تورنومنت‌های من
      </Link>
      <Suspense fallback={<LoadingRows rows={6} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const user = await requireUser("/partner/tournaments/new");
  if (user.role !== "PARTNER" || !(await canCreateTournament(user))) {
    return <Alert variant="warning">برای ساخت تورنومنت، همکار تأییدشده با اشتراکی شامل «برگزاری تورنومنت» باشید.</Alert>;
  }
  return <NewTournament basePath="/partner/tournaments" />;
}
