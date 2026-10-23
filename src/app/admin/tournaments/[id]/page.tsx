import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ManageTournament } from "@/components/tournaments/manage/pages";
import { LoadingRows } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "مدیریت تورنومنت" };

export default function AdminTournamentPage({ params }: PageProps<"/admin/tournaments/[id]">) {
  return (
    <>
      <Link href="/admin/tournaments" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> تورنومنت‌ها
      </Link>
      <Suspense fallback={<LoadingRows rows={8} />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: PageProps<"/admin/tournaments/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireRole(["ADMIN"], `/admin/tournaments/${id}`);
  return <ManageTournament id={id} user={user} basePath="/admin/tournaments" />;
}
