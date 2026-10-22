import Link from "next/link";
import { Logo } from "@/components/logo";
import { siteConfig } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function BrandLink({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5 rounded-lg", className)} aria-label={`${siteConfig.nameFa} — صفحهٔ اصلی`}>
      <Logo size={size} priority />
      <span className="ltr hidden text-[15px] leading-tight font-black tracking-wide sm:block">
        ATOM
        <span className="block text-[11px] font-bold tracking-[0.18em] text-muted-foreground">GAME CLUB</span>
      </span>
    </Link>
  );
}
