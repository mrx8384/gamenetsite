import Image from "next/image";
import { siteConfig } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** Official logo, displayed unmodified (only scaled). */
export function Logo({ size = 44, className, priority }: { size?: number; className?: string; priority?: boolean }) {
  const src = size > 128 ? siteConfig.logo.full : siteConfig.logo.small;
  return (
    <Image
      src={src}
      alt={siteConfig.name}
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0 select-none", className)}
    />
  );
}
