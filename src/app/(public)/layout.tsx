import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SupportWidgetLoader } from "@/components/support/support-widget-loader";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-strong focus:px-4 focus:py-2 focus:text-strong-foreground"
      >
        پرش به محتوای اصلی
      </a>
      <SiteHeader />
      {/* min-h-svh: while a page streams in, the footer stays below the screen instead of jumping down (CLS). */}
      <main id="main" className="flex min-h-svh flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
      <SupportWidgetLoader />
    </>
  );
}
