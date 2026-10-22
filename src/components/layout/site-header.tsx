import { Container } from "./container";
import { BrandLink } from "./brand-link";
import { DesktopNav } from "./desktop-nav";
import { MobileNav } from "./mobile-nav";

/** Sticky public header. Account and cart actions are added in Phases 5 and 7. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <MobileNav />
          <BrandLink />
        </div>
        <DesktopNav />
        {/* Reserved for account / cart actions (Phases 5 & 7). Keeps the nav centered on desktop. */}
        <div className="hidden w-[132px] lg:block" aria-hidden />
      </Container>
    </header>
  );
}
