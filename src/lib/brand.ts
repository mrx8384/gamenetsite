/**
 * Brand palette — single source of truth for docs and tests.
 * CSS tokens in `src/app/globals.css` must use the same values.
 */
export const brand = {
  green: "#00C96B",
  greenDark: "#008F4C",
  /** Darker green for text/links on light backgrounds (AA contrast). */
  greenDeep: "#00703C",
  cream: "#FAF9F3",
  yellow: "#FFDF00",
  black: "#111111",
  white: "#FFFFFF",
} as const;

export const siteConfig = {
  name: "ATOM GAME CLUB",
  nameFa: "اتم گیم کلاب",
  description: "باشگاه گیمینگ اتم؛ فروشگاه، کاتالوگ بازی‌ها، تورنومنت‌ها و خدمات همکاران.",
  locale: "fa-IR",
  logo: {
    full: "/brand/atom-logo.webp",
    small: "/brand/atom-logo-256.png",
  },
} as const;
