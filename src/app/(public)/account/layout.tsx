import { Container } from "@/components/layout/container";
import { AccountNav } from "@/components/account/account-nav";

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <Container className="grid gap-6 py-8 sm:py-12 md:grid-cols-[220px_1fr]">
      <aside className="md:sticky md:top-24 md:self-start">
        <AccountNav />
      </aside>
      <div className="min-w-0 space-y-6">{children}</div>
    </Container>
  );
}
