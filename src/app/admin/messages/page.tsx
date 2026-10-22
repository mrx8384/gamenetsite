import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "پیام‌ها" };
const PAGE_SIZE = 30;
const tabs = [["", "صندوق"], ["NEW", "نخوانده"], ["ARCHIVED", "بایگانی"]] as const;

export default function MessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  return (
    <>
      <AdminPageHeader title="پیام‌ها" description="پیام‌های فرم تماس با ما." />
      <Suspense fallback={<LoadingRows rows={6} />}><Messages searchParams={searchParams as Promise<{ status?: string; page?: string }>} /></Suspense>
    </>
  );
}

async function Messages({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireRole(["ADMIN"], "/admin/messages");
  const sp = await searchParams;
  const status: "NEW" | "ARCHIVED" | undefined = sp.status === "NEW" || sp.status === "ARCHIVED" ? sp.status : undefined;
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);
  const where: Prisma.ContactMessageWhereInput = status ? { status } : { status: { not: "ARCHIVED" } };
  const [total, messages, unread] = await Promise.all([
    db.contactMessage.count({ where }),
    db.contactMessage.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: { id: true, name: true, subject: true, body: true, status: true, createdAt: true } }),
    db.contactMessage.count({ where: { status: "NEW" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="space-y-4">
      <nav className="flex gap-2" aria-label="فیلتر پیام‌ها">
        {tabs.map(([s, label]) => (
          <Link key={s} href={s ? `/admin/messages?status=${s}` : "/admin/messages"} aria-current={(status ?? "") === s ? "page" : undefined}
            className={cn("rounded-full border px-4 py-1.5 text-sm", (status ?? "") === s ? "border-brand-green bg-brand-green/10 font-semibold" : "bg-surface hover:bg-secondary")}>
            {label}{s === "NEW" && unread ? ` (${formatNumber(unread)})` : ""}
          </Link>
        ))}
      </nav>
      {messages.length === 0 ? (
        <EmptyState icon={Inbox} title="پیامی نیست" />
      ) : (
        <ul className="divide-y rounded-xl border bg-surface">
          {messages.map((m) => (
            <li key={m.id}>
              <Link href={`/admin/messages/${m.id}`} className="flex flex-col gap-1 p-4 transition-colors hover:bg-secondary/50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={cn("flex items-center gap-2", m.status === "NEW" && "font-bold")}>
                    {m.status === "NEW" ? <span className="size-2 rounded-full bg-brand-green" aria-label="نخوانده" /> : null}
                    {m.name} — {m.subject}
                  </p>
                  <span className="text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</span>
                </div>
                <p className="line-clamp-1 text-sm text-muted-foreground">{m.body}</p>
                {m.status === "ARCHIVED" ? <Badge variant="outline" className="w-fit">بایگانی</Badge> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 ? (
        <nav aria-label="صفحه‌بندی" className="flex justify-between text-sm">
          <span className="text-muted-foreground">صفحهٔ {formatNumber(page)} از {formatNumber(pages)}</span>
          <div className="flex gap-2">
            {page > 1 ? <Button asChild variant="outline" size="sm"><Link href={`?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page - 1) })}`}>قبلی</Link></Button> : null}
            {page < pages ? <Button asChild variant="outline" size="sm"><Link href={`?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page + 1) })}`}>بعدی</Link></Button> : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
