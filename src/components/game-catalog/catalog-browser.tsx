"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, SearchX, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import type { CatalogGameView, CatalogPlatformView } from "@/features/game-catalog/queries";
import { formatNumber } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { normalizePersian } from "@/lib/text";
import { cn } from "@/lib/utils";

const POLL_MS = 30_000;

interface Props {
  platform: "PS4" | "PS5";
  categories: CatalogPlatformView["categories"];
  games: CatalogGameView[];
}

/** Public catalog: instant search, category chips, grouped grid, lightbox and live refresh. */
export function CatalogBrowser({ platform, categories, games }: Props) {
  const [query, setQuery] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState<number | null>(null);
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);
  useLiveRefresh(platform);

  const counts = React.useMemo(() => {
    const m = new Map<number, number>();
    for (const g of games) m.set(g.categoryId, (m.get(g.categoryId) ?? 0) + 1);
    return m;
  }, [games]);
  // Empty categories are hidden, like the original.
  const visibleCategories = categories.filter((c) => (counts.get(c.id) ?? 0) > 0);
  const category = activeCategory !== null && visibleCategories.some((c) => c.id === activeCategory) ? activeCategory : null;

  const q = normalizePersian(query).toLowerCase();
  const groups = visibleCategories
    .filter((c) => category === null || c.id === category)
    .map((c) => ({ ...c, games: games.filter((g) => g.categoryId === c.id && (!q || normalizePersian(g.name).toLowerCase().includes(q))) }))
    .filter((g) => g.games.length > 0);
  // Lightbox navigates through what is on screen, in display order.
  const flat = groups.flatMap((g) => g.games);
  const indexOf = new Map(flat.map((g, i) => [g.id, i]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="flex items-center gap-3 text-3xl font-black">
          <span className="h-8 w-1.5 rounded-full bg-brand-green" aria-hidden />
          بازی‌های <span className="ltr">{platform}</span>
        </h1>
        <p className="text-sm text-muted-foreground">{formatNumber(games.length)} بازی</p>
      </div>

      {games.length === 0 ? (
        <EmptyState title="هنوز بازی‌ای ثبت نشده است" description="به‌زودی بازی‌های این کنسول اضافه می‌شوند." />
      ) : (
        <>
          <div className="sticky top-16 z-10 -mx-4 space-y-3 bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جستجوی نام بازی…"
                aria-label="جستجوی نام بازی"
                className="ps-9"
              />
            </div>
            {visibleCategories.length > 1 ? (
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="فیلتر دسته‌بندی">
                <Chip active={category === null} onClick={() => setActiveCategory(null)} label="همه" count={games.length} />
                {visibleCategories.map((c) => (
                  <Chip key={c.id} active={category === c.id} onClick={() => setActiveCategory(c.id)} label={c.name} count={counts.get(c.id) ?? 0} />
                ))}
              </div>
            ) : null}
          </div>

          {groups.length === 0 ? (
            <EmptyState icon={SearchX} title="بازی‌ای پیدا نشد" description="عبارت دیگری را جستجو کنید." />
          ) : (
            groups.map((group) => (
              <section key={group.id} aria-labelledby={`cat-${group.id}`} className="space-y-3">
                <h2 id={`cat-${group.id}`} className="flex items-center gap-2 text-lg font-bold">
                  {group.name}
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">{formatNumber(group.games.length)}</span>
                </h2>
                <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                  {group.games.map((game) => (
                    <li key={game.id}>
                      <button
                        type="button"
                        onClick={() => setOpenIndex(indexOf.get(game.id) ?? 0)}
                        className="group block w-full cursor-zoom-in text-start"
                      >
                        <span className="relative block aspect-[3/4] overflow-hidden rounded-xl border bg-secondary shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md">
                          <Image src={mediaUrl(game.imageKey)} alt={game.name} fill unoptimized loading="lazy" sizes="(min-width:1024px) 16vw, (min-width:640px) 25vw, 33vw" className="object-cover" />
                        </span>
                        <span className="mt-1.5 line-clamp-2 block text-xs font-medium leading-5 sm:text-sm">{game.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}

      <Lightbox games={flat} index={openIndex !== null && openIndex < flat.length ? openIndex : null} onIndexChange={setOpenIndex} />
    </div>
  );
}

function Chip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active ? "border-brand-black bg-brand-black text-brand-cream" : "bg-surface hover:bg-secondary",
      )}
    >
      {label}
      <span className={cn("text-xs", active ? "text-brand-cream/70" : "text-muted-foreground")}>{formatNumber(count)}</span>
    </button>
  );
}

function Lightbox({ games, index, onIndexChange }: { games: CatalogGameView[]; index: number | null; onIndexChange: (i: number | null) => void }) {
  const touchX = React.useRef<number | null>(null);
  const dragRef = React.useRef(0);
  const [dragX, setDragX] = React.useState(0);
  const game = index !== null ? games[index] : null;
  const many = games.length > 1;

  const go = React.useCallback(
    (step: 1 | -1) => {
      if (index === null || games.length < 2) return;
      onIndexChange((index + step + games.length) % games.length);
    },
    [index, games.length, onIndexChange],
  );

  return (
    <DialogPrimitive.Root open={game !== null} onOpenChange={(open) => !open && onIndexChange(null)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-brand-black/90 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 p-4 outline-none data-[state=open]:animate-fade-in"
          onKeyDown={(e) => {
            // Same keys as the original (RTL): ← next, → previous.
            if (e.key === "ArrowLeft") go(1);
            else if (e.key === "ArrowRight") go(-1);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onIndexChange(null);
          }}
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX;
            dragRef.current = 0;
            setDragX(0);
          }}
          onTouchMove={(e) => {
            if (touchX.current === null) return;
            dragRef.current = e.touches[0].clientX - touchX.current;
            setDragX(dragRef.current);
          }}
          onTouchEnd={() => {
            if (touchX.current === null) return;
            touchX.current = null;
            const dx = dragRef.current;
            dragRef.current = 0;
            if (dx < -60) go(1);
            else if (dx > 60) go(-1);
            setDragX(0);
          }}
        >
          {game ? (
            <>
              <DialogPrimitive.Title className="max-w-full truncate px-12 text-center text-lg font-bold text-brand-cream">{game.name}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">تصویر بازی {game.name}</DialogPrimitive.Description>
              <div
                className="relative h-[70dvh] w-full max-w-md"
                style={{ transform: dragX ? `translateX(${dragX}px)` : undefined, transition: dragX ? "none" : "transform 200ms" }}
              >
                <Image key={game.id} src={mediaUrl(game.imageKey)} alt={game.name} fill unoptimized sizes="(min-width:640px) 448px, 100vw" className="rounded-xl object-contain" />
              </div>
              <p className="text-sm text-brand-cream/70" aria-live="polite">
                {formatNumber(index! + 1)} از {formatNumber(games.length)}
              </p>
              {many ? (
                <>
                  <button type="button" onClick={() => go(-1)} aria-label="بازی قبلی" className="absolute end-auto start-2 top-1/2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-brand-cream/15 text-brand-cream hover:bg-brand-cream/25 sm:start-6">
                    <ChevronRight className="size-6" />
                  </button>
                  <button type="button" onClick={() => go(1)} aria-label="بازی بعدی" className="absolute end-2 top-1/2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-brand-cream/15 text-brand-cream hover:bg-brand-cream/25 sm:end-6">
                    <ChevronLeft className="size-6" />
                  </button>
                </>
              ) : null}
              <DialogPrimitive.Close aria-label="بستن" className="absolute end-3 top-3 flex size-10 cursor-pointer items-center justify-center rounded-full bg-brand-cream/15 text-brand-cream hover:bg-brand-cream/25">
                <X className="size-5" />
              </DialogPrimitive.Close>
            </>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Polls a tiny version endpoint and refreshes the page when the catalog changes (new games appear without reload). */
function useLiveRefresh(platform: string) {
  const router = useRouter();
  React.useEffect(() => {
    let last: string | null = null;
    let stopped = false;
    async function check() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/catalog/version?p=${platform.toLowerCase()}`, { cache: "no-store" });
        if (!res.ok) return;
        const { version } = (await res.json()) as { version: string };
        if (stopped) return;
        if (last !== null && version !== last) router.refresh();
        last = version;
      } catch {
        // offline: try again next tick
      }
    }
    void check();
    const timer = window.setInterval(check, POLL_MS);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [platform, router]);
}
