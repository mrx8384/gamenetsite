"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/admin/settings", label: "فروش" },
  { href: "/admin/settings/home", label: "صفحهٔ اصلی" },
  { href: "/admin/settings/about", label: "درباره ما" },
  { href: "/admin/settings/contact", label: "تماس و شبکه‌های اجتماعی" },
  { href: "/admin/settings/general", label: "عمومی و فوتر" },
  { href: "/admin/settings/tournaments", label: "تورنومنت" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="بخش‌های تنظیمات" className="mb-6 flex gap-1 overflow-x-auto border-b">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn("shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors", active ? "border-brand-green text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
