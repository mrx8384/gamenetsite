import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ManageTournament } from "@/components/tournaments/manage/pages";
import { LoadingRows } from "@/components/ui/states";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "مدیریت تورنومنت", robots: { index: false } };

/** Co-organizers (any account added by the organizer) run the tournament from here. Rights: permissions.ts. */
export default function CoOrganizerTournamentPage({ params }: PageProps<"/account/tournaments/[id]">) {
  return (
    <>
      <Link href="/account/tournaments" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> تورنومنت‌های من
      </Link>
      <Suspense fallback={<LoadingRows rows={8} />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: PageProps<"/account/tournaments/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser(`/account/tournaments/${id}`);
  return <ManageTournament id={id} user={user} basePath="/account/tournaments" />;
}
