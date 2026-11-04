import type { Metadata } from "next";
import { Suspense } from "react";
import { PartnerAreaFooter, PartnerAreaHeader, PartnerHeaderFallback } from "@/components/partners/partner-shell";
import { SupportWidgetLoader } from "@/components/support/support-widget-loader";

// The tab icon follows the partner's approved logo (see /partner/brand-icon).
export const metadata: Metadata = { icons: { icon: "/partner/brand-icon" } };

/**
 * Partner area. While a partner's subscription is current it carries their own name and logo and no
 * Atom logo (owner request 2026-11-04); otherwise it looks like the rest of the site.
 */
export default function PartnerAreaLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-strong focus:px-4 focus:py-2 focus:text-strong-foreground"
      >
        پرش به محتوای اصلی
      </a>
      <Suspense fallback={<PartnerHeaderFallback />}>
        <PartnerAreaHeader />
      </Suspense>
      <main id="main" className="flex min-h-svh flex-1 flex-col">
        {children}
      </main>
      <Suspense fallback={null}>
        <PartnerAreaFooter />
      </Suspense>
      <SupportWidgetLoader />
    </>
  );
}
