import { Suspense } from "react";
import Link from "next/link";
import { Handshake, ShieldCheck, UserRound, Users } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { LoadingRows } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/format";

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
  const [total, admins, partners, users, newThisWeek] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: "ADMIN" } }),
    db.user.count({ where: { role: "PARTNER" } }),
    db.user.count({ where: { role: "USER" } }),
    db.user.count({ where: { createdAt: { gte: daysAgo(7) } } }),
  ]);
  const cards = [
    { label: "کل کاربران", value: total, icon: Users, href: "/admin/users" },
    { label: "کاربران عادی", value: users, icon: UserRound, href: "/admin/users?role=USER" },
    { label: "همکاران", value: partners, icon: Handshake, href: "/admin/users?role=PARTNER" },
    { label: "مدیران", value: admins, icon: ShieldCheck, href: "/admin/users?role=ADMIN" },
  ];
  return (
    <div className="space-y-4">
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
