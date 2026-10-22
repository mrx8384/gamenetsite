import { Suspense } from "react";
import Link from "next/link";
import { Handshake, Mail, Newspaper, PackageCheck, Receipt, ShieldCheck, UserRound, Users, Wallet } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { LoadingRows } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatNumber, formatToman } from "@/lib/format";

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
  await requireRole(["ADMIN"], "/admin"); // defense in depth: never rely on the layout alone
  const [total, admins, partners, users, newThisWeek, toProcess, awaiting, paidSum, unreadMessages, drafts] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: "ADMIN" } }),
    db.user.count({ where: { role: "PARTNER" } }),
    db.user.count({ where: { role: "USER" } }),
    db.user.count({ where: { createdAt: { gte: daysAgo(7) } } }),
    db.order.count({ where: { status: { in: ["PAID", "PROCESSING"] } } }),
    db.order.count({ where: { status: "AWAITING_PAYMENT" } }),
    db.order.aggregate({ where: { paidAt: { gte: daysAgo(30) }, status: { notIn: ["CANCELLED", "REFUNDED"] } }, _sum: { total: true } }),
    db.contactMessage.count({ where: { status: "NEW" } }),
    db.newsPost.count({ where: { status: "DRAFT" } }),
  ]);
  const orderCards = [
    { label: "سفارش‌های در انتظار ارسال", value: formatNumber(toProcess), icon: PackageCheck, href: "/admin/orders?status=PAID" },
    { label: "در انتظار پرداخت", value: formatNumber(awaiting), icon: Receipt, href: "/admin/orders?status=AWAITING_PAYMENT" },
    { label: "فروش ۳۰ روز اخیر", value: formatToman(paidSum._sum.total ?? BigInt(0)), icon: Wallet, href: "/admin/orders" },
    { label: "پیام‌های نخوانده", value: formatNumber(unreadMessages), icon: Mail, href: "/admin/messages?status=NEW" },
    { label: "پیش‌نویس‌های خبر", value: formatNumber(drafts), icon: Newspaper, href: "/admin/news?status=DRAFT" },
  ];
  const cards = [
    { label: "کل کاربران", value: total, icon: Users, href: "/admin/users" },
    { label: "کاربران عادی", value: users, icon: UserRound, href: "/admin/users?role=USER" },
    { label: "همکاران", value: partners, icon: Handshake, href: "/admin/users?role=PARTNER" },
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
    </div>
  );
}
