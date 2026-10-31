import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getSectionVisibility } from "@/features/settings/sections";
import { visibleLinks } from "@/features/settings/sections-schema";
import { mainNav } from "@/lib/nav";
import { AccountMenu } from "./account-menu";
import { CartButton } from "./cart-button";
import { Container } from "./container";
import { BrandLink } from "./brand-link";
import { DesktopNav, DesktopNavLinks } from "./desktop-nav";
import { MobileNav, MobileNavFallback } from "./mobile-nav";

/** Sticky public header. */
export async function SiteHeader() {
  // Cached settings read: menus drop sections hidden in Admin → تنظیمات سایت → نمایش بخش‌ها.
  const visibility = await getSectionVisibility();
  const items = visibleLinks(mainNav, visibility);
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <Suspense fallback={<MobileNavFallback />}>
            <MobileNav items={items} />
          </Suspense>
          <BrandLink />
        </div>
        {/* usePathname() needs a boundary on dynamic routes (e.g. /shop/[slug]). */}
        <Suspense fallback={<DesktopNavLinks items={items} pathname={null} />}>
          <DesktopNav items={items} />
        </Suspense>
        <div className="flex min-w-[132px] items-center justify-end gap-2">
          {visibility.shop ? (
            <Suspense fallback={null}>
              <CartButton />
            </Suspense>
          ) : null}
          <Suspense fallback={<Skeleton className="h-9 w-28" />}>
            <AccountMenu />
          </Suspense>
        </div>
      </Container>
    </header>
  );
}
