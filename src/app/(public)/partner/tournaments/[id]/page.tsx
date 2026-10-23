import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ManageTournament } from "@/components/tournaments/manage/pages";
import { LoadingRows } from "@/components/ui/states";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "مدیریت تورنومنت", robots: { index: false } };

export default function PartnerTournamentPage({ params }: PageProps<"/partner/tournaments/[id]">) {
  return (
    <>
      <Link href="/partner/tournaments" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> تورنومنت‌های من
      </Link>
      <Suspense fallback={<LoadingRows rows={8} />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: PageProps<"/partner/tournaments/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser(`/partner/tournaments/${id}`);
  if (user.role !== "PARTNER") notFound();
  return <ManageTournament id={id} user={user} basePath="/partner/tournaments" />;
}
