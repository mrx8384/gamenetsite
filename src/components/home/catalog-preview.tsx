import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getCatalogStats, type CatalogPlatformStats } from "@/features/game-catalog/queries";
import { formatNumber } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

export async function CatalogPreview() {
  await connection();
  const stats = await getCatalogStats();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {stats.map((s) => (
        <PlatformCard key={s.platform} stats={s} />
      ))}
    </div>
  );
}

function PlatformCard({ stats }: { stats: CatalogPlatformStats }) {
  const dark = stats.platform === "PS5";
  return (
    <Link
      href={`/game-catalog/${stats.platform.toLowerCase()}`}
      className={cn(
        "group relative flex min-h-56 flex-col justify-between overflow-hidden rounded-2xl border p-6 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-xl",
        dark ? "border-transparent bg-brand-black text-brand-cream" : "bg-surface",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="ltr text-start text-5xl font-black tracking-wider">{stats.platform}</p>
          <p className={cn("mt-2 text-sm", dark ? "text-brand-cream/70" : "text-muted-foreground")}>
            {stats.gameCount > 0 ? `${formatNumber(stats.gameCount)} بازی` : "به‌زودی"}
          </p>
        </div>
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-full transition-transform group-hover:-translate-x-1",
            dark ? "bg-brand-green text-brand-black" : "bg-brand-black text-brand-cream",
          )}
          aria-hidden
        >
          <ArrowLeft className="size-5" />
        </span>
      </div>
      {stats.recentCoverKeys.length > 0 ? (
        <div className="mt-6 flex ps-1">
          {stats.recentCoverKeys.map((key) => (
            <div
              key={key}
              className={cn(
                "relative -ms-3 h-24 w-[4.5rem] overflow-hidden rounded-lg border-2 shadow-md first:ms-0",
                dark ? "border-brand-black" : "border-surface",
              )}
            >
              <Image src={mediaUrl(key)} alt="" fill unoptimized sizes="72px" className="object-cover" />
            </div>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

export function CatalogPreviewSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2" role="status" aria-label="در حال بارگذاری">
      <Skeleton className="h-56 rounded-2xl" />
      <Skeleton className="h-56 rounded-2xl" />
    </div>
  );
}
