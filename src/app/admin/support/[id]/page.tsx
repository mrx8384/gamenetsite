import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { SupportThread } from "@/components/admin/support/support-thread";
import { LoadingRows } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "گفت‌وگوی پشتیبانی" };

export default function SupportConversationPage({ params }: PageProps<"/admin/support/[id]">) {
  return (
    <>
      <Link href="/admin/support" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> پشتیبانی آنلاین
      </Link>
      <Suspense fallback={<LoadingRows rows={8} />}>
        <Conversation params={params} />
      </Suspense>
    </>
  );
}

async function Conversation({ params }: { params: PageProps<"/admin/support/[id]">["params"] }) {
  const { id } = await params;
  const me = await requireRole(["ADMIN", "SUPPORT"], `/admin/support/${id}`);
  const conv = await db.supportConversation.findUnique({
    where: { id },
    select: { id: true, status: true, user: { select: { name: true, phone: true, email: true, role: true, createdAt: true } } },
  });
  if (!conv) notFound();
  const u = conv.user;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-2xl font-black">{u.name}</h1>
        {u.phone ? <a href={`tel:${u.phone}`} className="ltr text-sm text-link underline-offset-4 hover:underline">{u.phone}</a> : null}
        {u.email ? <a href={`mailto:${u.email}`} className="ltr text-sm text-link underline-offset-4 hover:underline">{u.email}</a> : null}
        <span className="text-xs text-muted-foreground">عضویت: {formatDate(u.createdAt)}</span>
        {me.role === "ADMIN" ? (
          <Link href={`/admin/users?q=${encodeURIComponent(u.phone ?? u.email ?? u.name)}`} className="text-xs text-link underline-offset-4 hover:underline">
            مشاهده در کاربران
          </Link>
        ) : null}
      </div>
      <SupportThread id={conv.id} initialStatus={conv.status} />
    </div>
  );
}
