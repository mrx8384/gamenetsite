import { z } from "zod";

/** Public sections the admin can hide (Admin → تنظیمات سایت → نمایش بخش‌ها). Contact stays always on. */
export const SECTION_DEFS = [
  { key: "shop", label: "فروشگاه", href: "/shop", hint: "صفحهٔ فروشگاه و محصولات، سبد خرید، محصولات منتخب صفحهٔ اصلی و دکمهٔ فروشگاه. با مخفی شدن، خرید آنلاین هم بسته می‌شود." },
  { key: "gameCatalog", label: "کاتالوگ بازی‌ها", href: "/game-catalog", hint: "صفحه‌های کاتالوگ PS4 و PS5 و بخش کاتالوگ صفحهٔ اصلی." },
  { key: "tournaments", label: "تورنومنت‌ها", href: "/tournaments", hint: "فهرست و صفحهٔ تورنومنت‌ها و نوار تورنومنت صفحهٔ اصلی. ابزار تست دسته برای همکاران باز می‌ماند." },
  { key: "park", label: "شهربازی اتم گیم", href: "/amusement-park", hint: "صفحهٔ معرفی شهربازی." },
  { key: "news", label: "اخبار", href: "/news", hint: "صفحهٔ اخبار، خبرها و بخش اخبار صفحهٔ اصلی." },
  { key: "partners", label: "همکاران", href: "/partners", hint: "صفحهٔ همکاری و بخش خدمات همکاران صفحهٔ اصلی. پنل همکارانِ فعلی باز می‌ماند." },
  { key: "about", label: "درباره ما", href: "/about", hint: "صفحهٔ درباره ما و بخش «درباره اتم» صفحهٔ اصلی." },
  { key: "atomWorld", label: "دنیای سه‌بعدی اتم", href: "/atom-world", hint: "دنیای سه‌بعدی و دکمه‌های ورود به آن." },
] as const;

export type SectionKey = (typeof SECTION_DEFS)[number]["key"];
export const SECTION_KEYS = SECTION_DEFS.map((s) => s.key) as SectionKey[];

export const sectionVisibilitySchema = z.object(
  Object.fromEntries(SECTION_KEYS.map((k) => [k, z.boolean().default(true)])) as Record<SectionKey, z.ZodDefault<z.ZodBoolean>>,
);
export type SectionVisibility = Record<SectionKey, boolean>;

/** Nav/footer links of hidden sections are dropped. */
export function visibleLinks<T extends { href: string }>(links: readonly T[], visibility: SectionVisibility): T[] {
  return links.filter((l) => {
    const owner = SECTION_DEFS.find((s) => l.href === s.href || l.href.startsWith(`${s.href}/`));
    // The gamepad tester lives under /tournaments but stays available for partners.
    if (owner?.key === "tournaments" && l.href.startsWith("/tournaments/gamepad-tester")) return true;
    return !owner || visibility[owner.key];
  });
}
