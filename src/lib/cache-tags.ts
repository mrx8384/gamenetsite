/** Cache tags used with `cacheTag()` and invalidated by admin mutations (`updateTag` / `revalidateTag`). */
export const CACHE_TAGS = {
  products: "products",
  news: "news",
  catalog: "catalog",
  settings: "settings",
  tournaments: "tournaments",
  faq: "faq",
} as const;
