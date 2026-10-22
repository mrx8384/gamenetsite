"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderTree,
  Gamepad2,
  Handshake,
  LayoutDashboard,
  Mail,
  Newspaper,
  Package,
  Receipt,
  Repeat,
  Settings,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Modules arrive phase by phase; unavailable ones are shown disabled. */
  available: boolean;
}

export const adminNav: AdminNavItem[] = [
  { href: "/admin", label: "داشبورد", icon: LayoutDashboard, available: true },
  { href: "/admin/users", label: "کاربران", icon: Users, available: true },
  { href: "/admin/products", label: "محصولات", icon: Package, available: true },
  { href: "/admin/categories", label: "دسته‌بندی‌ها", icon: FolderTree, available: true },
  { href: "/admin/orders", label: "سفارش‌ها", icon: Receipt, available: true },
  { href: "/admin/partners", label: "همکاران", icon: Handshake, available: false },
  { href: "/admin/subscriptions", label: "اشتراک‌ها", icon: Repeat, available: false },
  { href: "/admin/news", label: "اخبار", icon: Newspaper, available: false },
  { href: "/admin/messages", label: "پیام‌ها", icon: Mail, available: false },
  { href: "/admin/game-catalog", label: "کاتالوگ بازی‌ها", icon: Gamepad2, available: false },
  { href: "/admin/tournaments", label: "تورنومنت", icon: Trophy, available: false },
  { href: "/admin/settings", label: "تنظیمات فروش", icon: Settings, available: true },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="منوی مدیریت" className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
      {adminNav.map(({ href, label, icon: Icon, available }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        const cls = cn(
          "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active ? "bg-brand-green text-brand-black" : "text-brand-cream/75 hover:bg-white/10 hover:text-brand-cream",
          !available && "pointer-events-none opacity-40",
        );
        return available ? (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cls}>
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        ) : (
          <span key={href} className={cls} aria-disabled title="به‌زودی">
            <Icon className="size-4" aria-hidden />
            {label}
          </span>
        );
      })}
    </nav>
  );
}
