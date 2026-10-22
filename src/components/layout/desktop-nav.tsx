"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActivePath, mainNav } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="منوی اصلی" className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {mainNav.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-lg px-3 py-2 text-sm font-medium text-foreground/75 transition-colors hover:bg-secondary hover:text-foreground",
                  active && "text-foreground after:absolute after:inset-x-3 after:-bottom-[3px] after:h-[3px] after:rounded-full after:bg-brand-green",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
