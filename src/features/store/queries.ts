import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tags";

export interface ProductCardData {
  id: string;
  title: string;
  slug: string;
  /** Rial amount as string (bigint is not JSON-safe for client components). */
  price: string;
  compareAtPrice: string | null;
  inStock: boolean;
  imageKey: string | null;
  imageAlt: string | null;
  categoryName: string | null;
}

/** Featured, active products for the homepage. */
export async function getFeaturedProducts(limit = 4): Promise<ProductCardData[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.products);

  const rows = await db.product.findMany({
    where: { status: "ACTIVE", isFeatured: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      price: true,
      compareAtPrice: true,
      stock: true,
      category: { select: { name: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { alt: true, media: { select: { storageKey: true } } } },
    },
  });

  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    price: p.price.toString(),
    compareAtPrice: p.compareAtPrice?.toString() ?? null,
    inStock: p.stock > 0,
    imageKey: p.images[0]?.media.storageKey ?? null,
    imageAlt: p.images[0]?.alt ?? null,
    categoryName: p.category?.name ?? null,
  }));
}
