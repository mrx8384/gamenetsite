import { Container } from "@/components/layout/container";
import { Suspense } from "react";
import { AccountNav, AccountNavLinks } from "@/components/account/account-nav";

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <Container className="grid grid-cols-1 gap-6 py-8 sm:py-12 md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="md:sticky md:top-24 md:self-start">
        <Suspense fallback={<AccountNavLinks pathname={null} />}>
          <AccountNav />
        </Suspense>
      </aside>
      <div className="min-w-0 space-y-6">{children}</div>
    </Container>
  );
}
