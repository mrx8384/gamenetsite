"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderTree,
  Gamepad2,
  Handshake,
  Headset,
  LayoutDashboard,
  Mail,
  Newspaper,
  Package,
  Receipt,
  Repeat,
  Settings,
  Trophy,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { usePolling } from "@/components/support/chat-parts";
import { POLL_STAFF_BADGE_MS } from "@/features/support/constants";
import { cn } from "@/lib/utils";

type StaffRole = "ADMIN" | "USER" | "PARTNER" | "SUPPORT";

interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Roles that see the item (pages check roles again on the server). Default: ADMIN only. */
  roles?: StaffRole[];
}

export const adminNav: AdminNavItem[] = [
  { href: "/admin", label: "داشبورد", icon: LayoutDashboard },
  { href: "/admin/support", label: "پشتیبانی آنلاین", icon: Headset, roles: ["ADMIN", "SUPPORT"] },
  { href: "/admin/users", label: "کاربران", icon: Users },
  { href: "/admin/products", label: "محصولات", icon: Package },
  { href: "/admin/categories", label: "دسته‌بندی‌ها", icon: FolderTree },
  { href: "/admin/orders", label: "سفارش‌ها", icon: Receipt },
  { href: "/admin/shipping", label: "روش‌های ارسال", icon: Truck },
  { href: "/admin/partners", label: "همکاران", icon: Handshake },
  { href: "/admin/subscriptions", label: "اشتراک‌ها", icon: Repeat },
  { href: "/admin/news", label: "اخبار", icon: Newspaper },
  { href: "/admin/messages", label: "پیام‌ها", icon: Mail },
  { href: "/admin/game-catalog", label: "کاتالوگ بازی‌ها", icon: Gamepad2 },
  { href: "/admin/tournaments", label: "تورنومنت", icon: Trophy },
  { href: "/admin/settings", label: "تنظیمات سایت", icon: Settings },
];

/** Short two-tone chime via Web Audio (no audio file). Browsers allow it after the first click on the page. */
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
    setTimeout(() => void ctx.close(), 1000);
  } catch {
    // Sound is optional.
  }
}

/** Waiting support conversations; plays a chime when the number grows. */
function useSupportBadge() {
  const [count, setCount] = React.useState(0);
  const prev = React.useRef<number | null>(null);
  usePolling(async () => {
    const res = await fetch("/api/admin/support/unread", { cache: "no-store" });
    if (!res.ok) return;
    const { count: next } = (await res.json()) as { count: number };
    if (prev.current !== null && next > prev.current) chime();
    prev.current = next;
    setCount(next);
  }, POLL_STAFF_BADGE_MS);
  return count;
}

export function AdminNav({ role }: { role: StaffRole }) {
  const pathname = usePathname();
  const waiting = useSupportBadge();
  const items = adminNav.filter((i) => (i.roles ?? ["ADMIN"]).includes(role));
  return (
    <nav aria-label="منوی مدیریت" className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        const badge = href === "/admin/support" && waiting > 0 ? waiting : 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand-green text-brand-black" : "text-brand-cream/75 hover:bg-white/10 hover:text-brand-cream",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
            {badge ? (
              <span className="ms-auto min-w-5 rounded-full bg-destructive px-1.5 text-center text-xs font-bold text-white" aria-label={`${badge.toLocaleString("fa-IR")} گفت‌وگوی منتظر پاسخ`}>
                {badge.toLocaleString("fa-IR")}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
