import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import QRCode from "qrcode";
import { AddGamesCard } from "@/components/admin/game-catalog/add-games";
import { BackupCard } from "@/components/admin/game-catalog/backup-card";
import { CategoryManager } from "@/components/admin/game-catalog/category-manager";
import { GameList } from "@/components/admin/game-catalog/game-list";
import { QrCard } from "@/components/admin/game-catalog/qr-card";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { LoadingRows } from "@/components/ui/states";
import { platformFromSlug, PLATFORMS, type Platform } from "@/features/game-catalog/constants";
import { getAdminCatalog } from "@/features/game-catalog/admin-queries";
import { requireRole } from "@/lib/auth/dal";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "کاتالوگ بازی‌ها" };

export default function AdminGameCatalogPage({ searchParams }: PageProps<"/admin/game-catalog">) {
  return (
    <>
      <AdminPageHeader
        title="کاتالوگ بازی‌ها"
        description="بازی‌های PS4 و PS5 که مشتریان در سایت و با اسکن QR می‌بینند."
        actions={
          <Button asChild variant="outline">
            <Link href="/game-catalog" target="_blank"><ExternalLink /> مشاهدهٔ کاتالوگ</Link>
          </Button>
        }
      />
      <Suspense fallback={<LoadingRows rows={6} />}>
        <CatalogAdmin searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CatalogAdmin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole(["ADMIN"], "/admin/game-catalog");
  const p = (await searchParams).p;
  const platform: Platform = platformFromSlug(typeof p === "string" ? p : "") ?? "PS4";
  const data = await getAdminCatalog(platform);

  const base = env.APP_URL.replace(/\/+$/, "");
  const qr = await Promise.all(
    PLATFORMS.map(async (pl) => {
      const url = `${base}/game-catalog/${pl.toLowerCase()}`;
      const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } });
      return { platform: pl, url, svg };
    }),
  );
  const categoryNames = data.categories.filter((c) => !c.isDefault).map((c) => c.name);

  return (
    <div className="space-y-6">
      <nav aria-label="پلتفرم" className="inline-flex gap-1 rounded-xl bg-secondary p-1">
        {PLATFORMS.map((pl) => (
          <Link
            key={pl}
            href={`/admin/game-catalog?p=${pl.toLowerCase()}`}
            aria-current={pl === platform ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-colors",
              pl === platform ? "bg-surface shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="ltr">{pl}</span>
            <span className="text-xs font-normal text-muted-foreground">{formatNumber(data.totals[pl])}</span>
          </Link>
        ))}
      </nav>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <AddGamesCard key={`add-${platform}`} platform={platform} categoryNames={categoryNames} />
          <GameList key={`list-${platform}`} platform={platform} games={data.games} categoryNames={categoryNames} />
        </div>
        <div className="space-y-6">
          <CategoryManager key={`cat-${platform}`} platform={platform} categories={data.categories} />
          <QrCard items={qr} />
          <BackupCard
            lastImport={data.lastImport ? { at: data.lastImport.createdAt.toISOString(), fileName: data.lastImport.sourceFileName, games: data.lastImport.gamesImported } : null}
          />
        </div>
      </div>
    </div>
  );
}
