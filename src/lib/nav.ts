export interface NavItem {
  href: string;
  label: string;
}

/** Main public navigation (header, mobile menu, footer). */
export const mainNav: NavItem[] = [
  { href: "/shop", label: "فروشگاه" },
  { href: "/game-catalog", label: "کاتالوگ بازی‌ها" },
  { href: "/tournaments", label: "تورنومنت‌ها" },
  { href: "/news", label: "اخبار" },
  { href: "/partners", label: "همکاران" },
  { href: "/about", label: "درباره ما" },
  { href: "/contact", label: "تماس با ما" },
];

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
