import { cache, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Building2, Gamepad, LayoutDashboard, Trophy } from "lucide-react";
import { AccountMenu } from "@/components/layout/account-menu";
import { Container } from "@/components/layout/container";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getPartnerBranding, type PartnerBranding } from "@/features/partners/branding";
import { getCurrentUser } from "@/lib/auth/dal";

/** One lookup per request for header + footer. */
const brandingForRequest = cache(async (): Promise<PartnerBranding | null> => {
  const user = await getCurrentUser();
  return user ? getPartnerBranding(user.id) : null;
});

const NAV = [
  { href: "/partner", label: "داشبورد", icon: LayoutDashboard },
  { href: "/partner/tournaments", label: "تورنومنت‌ها", icon: Trophy },
  { href: "/partner/gamepad-tester", label: "تست دسته", icon: Gamepad },
];

function PartnerMark({ b }: { b: PartnerBranding }) {
  return (
    <Link href="/partner" className="flex min-w-0 items-center gap-2.5 rounded-lg" aria-label={`${b.businessName} — پنل`}>
      <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white">
        {b.logoUrl ? <Image src={b.logoUrl} alt="" fill sizes="40px" className="object-contain p-0.5" priority /> : <Building2 className="size-5 text-muted-foreground" aria-hidden />}
      </span>
      <span className="truncate text-[15px] font-black">{b.businessName}</span>
    </Link>
  );
}

/** Neutral bar shown while the branding is looked up (never flashes the Atom logo for white-label partners). */
export function PartnerHeaderFallback() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-9 w-28" />
      </Container>
    </header>
  );
}

/** Partner area header: the partner's own brand while their subscription is current, otherwise the site header. */
export async function PartnerAreaHeader() {
  const b = await brandingForRequest();
  if (!b) return <SiteHeader />;
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <Container className="flex h-16 items-center justify-between gap-3">
        <PartnerMark b={b} />
        <div className="flex shrink-0 items-center gap-2">
          <Suspense fallback={<Skeleton className="h-9 w-28" />}>
            <AccountMenu />
          </Suspense>
        </div>
      </Container>
      <nav aria-label="پنل همکار" className="border-t border-border/60">
        <Container className="no-scrollbar flex gap-1 overflow-x-auto py-1.5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
              <Icon className="size-4" aria-hidden /> {label}
            </Link>
          ))}
        </Container>
      </nav>
    </header>
  );
}

export async function PartnerAreaFooter() {
  const b = await brandingForRequest();
  if (!b) return <SiteFooter />;
  return (
    <footer className="border-t bg-surface">
      <Container className="py-6 text-center text-sm text-muted-foreground">{b.businessName}</Container>
    </footer>
  );
}
