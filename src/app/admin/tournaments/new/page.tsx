import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NewTournament } from "@/components/tournaments/manage/pages";
import { LoadingRows } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "تورنومنت جدید" };

export default function AdminNewTournamentPage() {
  return (
    <>
      <Link href="/admin/tournaments" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> تورنومنت‌ها
      </Link>
      <Suspense fallback={<LoadingRows rows={6} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await requireRole(["ADMIN"], "/admin/tournaments/new");
  return <NewTournament basePath="/admin/tournaments" />;
}
