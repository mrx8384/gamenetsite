import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Search, ShoppingBag } from "lucide-react";
import { Container } from "@/components/layout/container";
import { ProductCard } from "@/components/store/product-card";
import { ProductGridSkeleton } from "@/components/home/featured-products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState } from "@/components/ui/states";
import { getShopCategories, getShopProducts, SHOP_PAGE_SIZE, SHOP_SORTS, type ShopFilters, type ShopSort } from "@/features/store/queries";
import { formatNumber, toEnglishDigits } from "@/lib/format";
import { normalizePersian } from "@/lib/text";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "فروشگاه", description: "محصولات گیمینگ آتم گیم کلاب" };

type SP = Record<string, string | string[] | undefined>;

function parseFilters(sp: SP): ShopFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? "";
  const sort = SHOP_SORTS.includes(one("sort") as ShopSort) ? (one("sort") as ShopSort) : "newest";
  return {
    q: normalizePersian(toEnglishDigits(one("q"))).slice(0, 80),
    category: one("category") ? one("category").slice(0, 100) : null,
    sort,
    inStock: one("stock") === "1",
    page: Math.min(500, Math.max(1, Number.parseInt(one("page"), 10) || 1)),
  };
}

function hrefWith(f: ShopFilters, patch: Partial<ShopFilters>): string {
  const n = { ...f, ...patch };
  const p = new URLSearchParams();
  if (n.q) p.set("q", n.q);
  if (n.category) p.set("category", n.category);
  if (n.sort !== "newest") p.set("sort", n.sort);
  if (n.inStock) p.set("stock", "1");
  if (n.page > 1) p.set("page", String(n.page));
  const s = p.toString();
  return s ? `/shop?${s}` : "/shop";
}

export default function ShopPage({ searchParams }: PageProps<"/shop">) {
  return (
    <Container className="py-8 sm:py-12">
      <div className="mb-8 space-y-2">
        <h1 className="flex items-center gap-3 text-3xl font-black">
          <span className="h-8 w-1.5 rounded-full bg-brand-green" aria-hidden />
          فروشگاه
        </h1>
        <p className="text-muted-foreground">محصولات منتخب گیمینگ با قیمت شفاف.</p>
      </div>
      <Suspense fallback={<ProductGridSkeleton />}>
        <ShopContent searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function ShopContent({ searchParams }: { searchParams: Promise<SP> }) {
  const filters = parseFilters(await searchParams);
  const [categories, { items, total }] = await Promise.all([getShopCategories(), getShopProducts(filters)]);
  const pages = Math.max(1, Math.ceil(total / SHOP_PAGE_SIZE));
  const roots = categories.filter((c) => !c.parentId);

  return (
    <div className="grid gap-8 lg:grid-cols-[230px_1fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-3 text-sm font-bold">دسته‌بندی‌ها</p>
        <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
          <li className="contents lg:block">
            <CategoryLink href={hrefWith(filters, { category: null, page: 1 })} active={!filters.category} label="همهٔ محصولات" />
          </li>
          {roots.map((c) => (
            <li key={c.id} className="contents lg:block">
              <CategoryLink href={hrefWith(filters, { category: c.slug, page: 1 })} active={filters.category === c.slug} label={c.name} count={c.productCount} />
              {categories
                .filter((s) => s.parentId === c.id)
                .map((s) => (
                  <CategoryLink key={s.id} href={hrefWith(filters, { category: s.slug, page: 1 })} active={filters.category === s.slug} label={s.name} count={s.productCount} sub />
                ))}
            </li>
          ))}
        </ul>
      </aside>

      <div className="min-w-0 space-y-5">
        <form action="/shop" className="grid gap-3 rounded-xl border bg-surface p-3 sm:grid-cols-[1fr_170px_auto_auto] sm:items-center" role="search">
          {filters.category ? <input type="hidden" name="category" value={filters.category} /> : null}
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input name="q" defaultValue={filters.q} placeholder="جست‌وجوی محصول یا کد کالا" className="ps-9" aria-label="جست‌وجو" />
          </div>
          <NativeSelect name="sort" defaultValue={filters.sort} aria-label="مرتب‌سازی">
            <option value="newest">جدیدترین</option>
            <option value="price-asc">ارزان‌ترین</option>
            <option value="price-desc">گران‌ترین</option>
          </NativeSelect>
          <label className="flex cursor-pointer items-center gap-2 px-1 text-sm whitespace-nowrap">
            <input type="checkbox" name="stock" value="1" defaultChecked={filters.inStock} className="size-4 accent-[var(--brand-green-dark)]" />
            فقط موجود
          </label>
          <Button type="submit" variant="strong">
            اعمال
          </Button>
        </form>

        <p className="text-sm text-muted-foreground">{formatNumber(total)} محصول</p>

        {items.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title={filters.q || filters.category || filters.inStock ? "محصولی با این مشخصات پیدا نشد" : "هنوز محصولی اضافه نشده"}
            description={filters.q || filters.category || filters.inStock ? "فیلترها را تغییر دهید یا عبارت دیگری جست‌وجو کنید." : "محصولات به‌زودی اضافه می‌شوند."}
            action={
              filters.q || filters.category || filters.inStock ? (
                <Button asChild variant="outline">
                  <Link href="/shop">حذف فیلترها</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        {pages > 1 ? (
          <nav aria-label="صفحه‌بندی" className="flex items-center justify-center gap-2 pt-2">
            {filters.page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={hrefWith(filters, { page: filters.page - 1 })}>قبلی</Link>
              </Button>
            ) : null}
            <span className="px-3 text-sm text-muted-foreground">
              صفحهٔ {formatNumber(filters.page)} از {formatNumber(pages)}
            </span>
            {filters.page < pages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={hrefWith(filters, { page: filters.page + 1 })}>بعدی</Link>
              </Button>
            ) : null}
          </nav>
        ) : null}
      </div>
    </div>
  );
}

function CategoryLink({ href, active, label, count, sub }: { href: string; active: boolean; label: string; count?: number; sub?: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm whitespace-nowrap transition-colors lg:border-transparent",
        active ? "border-brand-green bg-brand-green/10 font-semibold lg:border-brand-green/0" : "bg-surface hover:bg-secondary lg:bg-transparent",
        sub && "lg:ps-7",
      )}
    >
      {label}
      {count !== undefined ? <span className="text-xs text-muted-foreground">{formatNumber(count)}</span> : null}
    </Link>
  );
}
