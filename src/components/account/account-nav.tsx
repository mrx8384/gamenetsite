"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Handshake, Package, ShieldCheck, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/account", label: "اطلاعات حساب", icon: UserRound },
  { href: "/account/orders", label: "سفارش‌های من", icon: Package },
  { href: "/account/security", label: "امنیت و نشست‌ها", icon: ShieldCheck },
  { href: "/partner", label: "پنل همکار", icon: Handshake },
];

export function AccountNav() {
  return <AccountNavLinks pathname={usePathname()} />;
}

/** `pathname = null` renders without an active item (static fallback for dynamic routes). */
export function AccountNavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="منوی حساب کاربری" className="flex gap-1 overflow-x-auto md:flex-col">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname !== null && (href === "/account" ? pathname === href : pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
              active && "bg-surface text-foreground shadow-sm",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
