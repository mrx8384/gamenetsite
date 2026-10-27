import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/game-rewards", label: "قوانین امتیاز و دستاوردها" },
  { href: "/admin/game-rewards/cards", label: "کارت‌های تخفیف" },
  { href: "/admin/game-rewards/codes", label: "بررسی کد و امتیاز کاربر" },
] as const;

/** Tabs of Admin → دستاوردها و جوایز (each page passes its own path). */
export function GameRewardsNav({ current }: { current: (typeof TABS)[number]["href"] }) {
  return (
    <nav aria-label="بخش‌های دستاوردها و جوایز" className="mb-6 flex flex-wrap gap-2">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === current ? "page" : undefined}
          className={cn("rounded-lg border px-3 py-1.5 text-sm font-medium", t.href === current ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:bg-secondary")}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
