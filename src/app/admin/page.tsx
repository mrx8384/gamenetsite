import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Cpu, HardDrive, Handshake, Headset, Mail, MemoryStick, Newspaper, PackageCheck, Receipt, Server, ShieldCheck, UserRound, Users, Wallet } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { LoadingRows } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatNumber, formatToman } from "@/lib/format";
import { formatPct } from "@/features/server-status/format";
import { levelOf, THRESHOLDS } from "@/features/server-status/parse";
import { cn } from "@/lib/utils";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 3600 * 1000);
}

export default function AdminDashboard() {
  return (
    <>
      <AdminPageHeader title="داشبورد" description="نمای کلی سایت. بخش‌های بیشتر همراه با هر فاز اضافه می‌شوند." />
      <Suspense fallback={<LoadingRows rows={2} />}>
        <Stats />
      </Suspense>
    </>
  );
}

async function Stats() {
  const me = await requireRole(["ADMIN", "SUPPORT"], "/admin"); // defense in depth: never rely on the layout alone
  if (me.role === "SUPPORT") redirect("/admin/support"); // support staff only have the support inbox
  const [total, admins, partners, users, newThisWeek, toProcess, awaiting, paidSum, unreadMessages, drafts, pendingPartners, waitingChats] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: "ADMIN" } }),
    db.user.count({ where: { role: "PARTNER" } }),
    db.user.count({ where: { role: "USER" } }),
    db.user.count({ where: { createdAt: { gte: daysAgo(7) } } }),
    db.order.count({ where: { status: { in: ["PAID", "PROCESSING"] } } }),
    db.order.count({ where: { status: "AWAITING_PAYMENT" } }),
    db.order.aggregate({ where: { isTest: false, paidAt: { gte: daysAgo(30) }, status: { notIn: ["CANCELLED", "REFUNDED"] } }, _sum: { total: true } }),
    db.contactMessage.count({ where: { status: "NEW" } }),
    db.newsPost.count({ where: { status: "DRAFT" } }),
    db.partnerProfile.count({ where: { status: "PENDING" } }),
    db.supportConversation.count({ where: { unreadByStaff: { gt: 0 } } }),
  ]);
  const orderCards = [
    { label: "سفارش‌های در انتظار ارسال", value: formatNumber(toProcess), icon: PackageCheck, href: "/admin/orders?status=PAID" },
    { label: "در انتظار پرداخت", value: formatNumber(awaiting), icon: Receipt, href: "/admin/orders?status=AWAITING_PAYMENT" },
    { label: "فروش ۳۰ روز اخیر", value: formatToman(paidSum._sum.total ?? BigInt(0)), icon: Wallet, href: "/admin/orders" },
    { label: "گفت‌وگوهای منتظر پاسخ", value: formatNumber(waitingChats), icon: Headset, href: "/admin/support" },
    { label: "پیام‌های نخوانده", value: formatNumber(unreadMessages), icon: Mail, href: "/admin/messages?status=NEW" },
    { label: "پیش‌نویس‌های خبر", value: formatNumber(drafts), icon: Newspaper, href: "/admin/news?status=DRAFT" },
    { label: "درخواست‌های همکاری", value: formatNumber(pendingPartners), icon: Handshake, href: "/admin/partners" },
  ];
  const cards = [
    { label: "کل کاربران", value: total, icon: Users, href: "/admin/users" },
    { label: "کاربران عادی", value: users, icon: UserRound, href: "/admin/users?role=USER" },
    { label: "همکاران", value: partners, icon: Handshake, href: "/admin/partners?status=APPROVED" },
    { label: "مدیران", value: admins, icon: ShieldCheck, href: "/admin/users?role=ADMIN" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {orderCards.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href}>
            <Card className="flex items-center gap-4 p-5 transition-shadow hover:shadow-lg">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-yellow/40 text-brand-black">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-xl font-black">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href}>
            <Card className="flex items-center gap-4 p-5 transition-shadow hover:shadow-lg">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-green/15 text-brand-green-deep">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-2xl font-black">{formatNumber(value)}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{formatNumber(newThisWeek)} کاربر جدید در ۷ روز گذشته.</p>
      <ServerStrip />
    </div>
  );
}

/** Latest per-minute server sample (Admin → وضعیت سرور), so a full disk or busy server is noticed early. */
async function ServerStrip() {
  const m = await db.serverMetric.findFirst({ orderBy: { createdAt: "desc" } });
  if (!m) return null;
  const pct = (a: bigint, b: bigint) => (b > BigInt(0) ? (Number(a) / Number(b)) * 100 : 0);
  const items = [
    { label: "پردازنده", icon: Cpu, value: m.cpu, level: levelOf(m.cpu, THRESHOLDS.cpu) },
    { label: "رم", icon: MemoryStick, value: pct(m.memUsed, m.memTotal), level: levelOf(pct(m.memUsed, m.memTotal), THRESHOLDS.memory) },
    { label: "دیسک", icon: HardDrive, value: pct(m.diskUsed, m.diskTotal), level: levelOf(pct(m.diskUsed, m.diskTotal), THRESHOLDS.disk) },
  ];
  const levelText = { ok: "", high: "زیاد", critical: "بحرانی" } as const;
  return (
    <Link href="/admin/server" className="block">
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-3 p-5 transition-shadow hover:shadow-lg">
        <p className="flex items-center gap-2 font-bold"><Server className="size-5" aria-hidden /> وضعیت سرور</p>
        {items.map(({ label, icon: Icon, value, level }) => (
          <p key={label} className={cn("flex items-center gap-1.5 text-sm", level === "critical" ? "font-bold text-destructive" : level === "high" ? "font-bold text-warning" : "text-muted-foreground")}>
            <Icon className="size-4" aria-hidden /> {label}: <span className="font-bold text-foreground">{formatPct(value)}</span>
            {levelText[level] ? <span>({levelText[level]})</span> : null}
          </p>
        ))}
        <span className="ms-auto text-xs font-semibold text-link">جزئیات و نمودارها ←</span>
      </Card>
    </Link>
  );
}
