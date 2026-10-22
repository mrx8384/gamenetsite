import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountMenu } from "./account-menu";
import { Container } from "./container";
import { BrandLink } from "./brand-link";
import { DesktopNav, DesktopNavLinks } from "./desktop-nav";
import { MobileNav, MobileNavFallback } from "./mobile-nav";

/** Sticky public header. Cart action is added in Phase 7. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <Suspense fallback={<MobileNavFallback />}>
            <MobileNav />
          </Suspense>
          <BrandLink />
        </div>
        {/* usePathname() needs a boundary on dynamic routes (e.g. /shop/[slug]). */}
        <Suspense fallback={<DesktopNavLinks pathname={null} />}>
          <DesktopNav />
        </Suspense>
        <div className="flex min-w-[132px] items-center justify-end gap-2">
          <Suspense fallback={<Skeleton className="h-9 w-28" />}>
            <AccountMenu />
          </Suspense>
        </div>
      </Container>
    </header>
  );
}
