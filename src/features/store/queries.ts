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

// ───────────── Shop listing & detail ─────────────

export interface ShopCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  productCount: number;
}

/** Active categories with the number of active products (including direct sub-categories). */
export async function getShopCategories(): Promise<ShopCategory[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.products);

  const rows = await db.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, parentId: true, _count: { select: { products: { where: { status: "ACTIVE" } } } } },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parentId,
    productCount: c._count.products + rows.filter((x) => x.parentId === c.id).reduce((n, x) => n + x._count.products, 0),
  }));
}

export const SHOP_SORTS = ["newest", "price-asc", "price-desc"] as const;
export type ShopSort = (typeof SHOP_SORTS)[number];
export const SHOP_PAGE_SIZE = 12;

export interface ShopFilters {
  q: string;
  category: string | null;
  sort: ShopSort;
  inStock: boolean;
  page: number;
}

export async function getShopProducts(filters: ShopFilters): Promise<{ items: ProductCardData[]; total: number }> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.products);

  let categoryIds: string[] | undefined;
  if (filters.category) {
    const cat = await db.category.findFirst({
      where: { slug: filters.category, isActive: true },
      select: { id: true, children: { where: { isActive: true }, select: { id: true } } },
    });
    if (!cat) return { items: [], total: 0 };
    categoryIds = [cat.id, ...cat.children.map((c) => c.id)];
  }

  const where = {
    status: "ACTIVE" as const,
    ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
    ...(filters.inStock ? { stock: { gt: 0 } } : {}),
    ...(filters.q
      ? { OR: [{ title: { contains: filters.q, mode: "insensitive" as const } }, { sku: { equals: filters.q.toUpperCase() } }] }
      : {}),
  };
  const orderBy =
    filters.sort === "price-asc"
      ? [{ price: "asc" as const }, { id: "asc" as const }]
      : filters.sort === "price-desc"
        ? [{ price: "desc" as const }, { id: "asc" as const }]
        : [{ createdAt: "desc" as const }, { id: "asc" as const }];

  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy,
      skip: (filters.page - 1) * SHOP_PAGE_SIZE,
      take: SHOP_PAGE_SIZE,
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
    }),
  ]);

  return {
    total,
    items: rows.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      price: p.price.toString(),
      compareAtPrice: p.compareAtPrice?.toString() ?? null,
      inStock: p.stock > 0,
      imageKey: p.images[0]?.media.storageKey ?? null,
      imageAlt: p.images[0]?.alt ?? null,
      categoryName: p.category?.name ?? null,
    })),
  };
}

export interface ProductDetail {
  id: string;
  title: string;
  slug: string;
  sku: string;
  shortDescription: string | null;
  description: string | null;
  price: string;
  compareAtPrice: string | null;
  stock: number;
  category: { name: string; slug: string; parent: { name: string; slug: string } | null } | null;
  images: { key: string; alt: string | null; width: number | null; height: number | null }[];
}

/** Only ACTIVE products are visible publicly. */
export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.products);

  const p = await db.product.findFirst({
    where: { slug, status: "ACTIVE" },
    select: {
      id: true,
      title: true,
      slug: true,
      sku: true,
      shortDescription: true,
      descriptionJson: true,
      price: true,
      compareAtPrice: true,
      stock: true,
      category: { select: { name: true, slug: true, isActive: true, parent: { select: { name: true, slug: true } } } },
      images: { orderBy: { sortOrder: "asc" }, select: { alt: true, media: { select: { storageKey: true, width: true, height: true } } } },
    },
  });
  if (!p) return null;
  const desc = p.descriptionJson as { format?: string; text?: string } | null;
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    sku: p.sku,
    shortDescription: p.shortDescription,
    description: desc?.format === "plain" ? (desc.text ?? null) : null,
    price: p.price.toString(),
    compareAtPrice: p.compareAtPrice?.toString() ?? null,
    stock: p.stock,
    category: p.category?.isActive ? { name: p.category.name, slug: p.category.slug, parent: p.category.parent } : null,
    images: p.images.map((i) => ({ key: i.media.storageKey, alt: i.alt, width: i.media.width, height: i.media.height })),
  };
}

export async function getRelatedProducts(productId: string, categorySlug: string | null, limit = 4): Promise<ProductCardData[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.products);
  if (!categorySlug) return [];
  const rows = await db.product.findMany({
    where: { status: "ACTIVE", id: { not: productId }, category: { slug: categorySlug } },
    orderBy: { createdAt: "desc" },
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
