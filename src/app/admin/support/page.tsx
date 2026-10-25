import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Headset, Search } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { InboxRefresh } from "@/components/admin/support/support-thread";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTime, formatNumber, toEnglishDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "پشتیبانی آنلاین" };
const PAGE_SIZE = 30;
const tabs = [["", "باز"], ["waiting", "منتظر پاسخ"], ["closed", "بسته"]] as const;
type Search = { tab?: string; q?: string; page?: string };

export default function SupportInboxPage({ searchParams }: PageProps<"/admin/support">) {
  return (
    <>
      <AdminPageHeader title="پشتیبانی آنلاین" description="گفت‌وگوهای کاربران با پشتیبانی. این صفحه خودکار به‌روز می‌شود." />
      <Suspense fallback={<LoadingRows rows={6} />}>
        <Inbox searchParams={searchParams as Promise<Search>} />
      </Suspense>
    </>
  );
}

async function Inbox({ searchParams }: { searchParams: Promise<Search> }) {
  await requireRole(["ADMIN", "SUPPORT"], "/admin/support");
  const sp = await searchParams;
  const tab = sp.tab === "waiting" || sp.tab === "closed" ? sp.tab : "";
  const q = toEnglishDigits(String(sp.q ?? "")).trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);

  const where: Prisma.SupportConversationWhereInput = {
    ...(tab === "closed" ? { status: "CLOSED" } : { status: "OPEN" }),
    ...(tab === "waiting" ? { unreadByStaff: { gt: 0 } } : {}),
    ...(q
      ? { user: { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q.toLowerCase() } }] } }
      : {}),
  };
  const [total, waiting, rows] = await Promise.all([
    db.supportConversation.count({ where }),
    db.supportConversation.count({ where: { unreadByStaff: { gt: 0 } } }),
    db.supportConversation.findMany({
      where,
      orderBy: [{ lastMessageAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        status: true,
        unreadByStaff: true,
        lastMessageAt: true,
        user: { select: { name: true, phone: true, email: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, fromStaff: true } },
      },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => `?${new URLSearchParams({ ...(tab ? { tab } : {}), ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <div className="space-y-4">
      <InboxRefresh />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-2" aria-label="فیلتر گفت‌وگوها">
          {tabs.map(([t, label]) => (
            <Link
              key={t}
              href={t ? `/admin/support?tab=${t}` : "/admin/support"}
              aria-current={tab === t ? "page" : undefined}
              className={cn("rounded-full border px-4 py-1.5 text-sm", tab === t ? "border-brand-green bg-brand-green/10 font-semibold" : "bg-surface hover:bg-secondary")}
            >
              {label}
              {t === "waiting" && waiting ? ` (${formatNumber(waiting)})` : ""}
            </Link>
          ))}
        </nav>
        <form role="search" className="relative w-full sm:w-72">
          {tab ? <input type="hidden" name="tab" value={tab} /> : null}
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="نام، موبایل یا ایمیل" className="ps-9" aria-label="جست‌وجو در گفت‌وگوها" />
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Headset} title="گفت‌وگویی نیست" description={tab === "waiting" ? "همهٔ پیام‌ها پاسخ داده شده‌اند." : undefined} />
      ) : (
        <ul className="divide-y rounded-xl border bg-surface">
          {rows.map((c) => {
            const lastMsg = c.messages[0];
            return (
              <li key={c.id}>
                <Link href={`/admin/support/${c.id}`} className="flex flex-col gap-1 p-4 transition-colors hover:bg-secondary/50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={cn("flex items-center gap-2", c.unreadByStaff > 0 && "font-bold")}>
                      {c.unreadByStaff > 0 ? (
                        <span className="min-w-5 rounded-full bg-destructive px-1.5 text-center text-xs font-bold text-white" aria-label={`${formatNumber(c.unreadByStaff)} پیام جدید`}>
                          {formatNumber(c.unreadByStaff)}
                        </span>
                      ) : null}
                      {c.user.name}
                      <span className="ltr text-xs font-normal text-muted-foreground">{c.user.phone ?? c.user.email}</span>
                    </p>
                    <span className="text-xs text-muted-foreground">{formatDateTime(c.lastMessageAt)}</span>
                  </div>
                  {lastMsg ? (
                    <p className="line-clamp-1 text-sm text-muted-foreground">
                      {lastMsg.fromStaff ? "شما: " : ""}
                      {lastMsg.body}
                    </p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label="صفحه‌بندی" className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            صفحهٔ {formatNumber(page)} از {formatNumber(pages)}
          </span>
          <div className="flex gap-2">
            {page > 1 ? <Button asChild variant="outline" size="sm"><Link href={qs(page - 1)}>قبلی</Link></Button> : null}
            {page < pages ? <Button asChild variant="outline" size="sm"><Link href={qs(page + 1)}>بعدی</Link></Button> : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
