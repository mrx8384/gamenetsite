import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

/** Interim page for sections whose phase is not built yet. Replaced when the phase ships. */
export function ComingSoon({ title, description, icon: Icon }: { title: string; description: string; icon: LucideIcon }) {
  return (
    <Container className="flex flex-1 flex-col items-center justify-center gap-5 py-20 text-center sm:py-28">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-brand-green/15 text-brand-green-deep">
        <Icon className="size-8" aria-hidden />
      </span>
      <h1 className="text-3xl font-black">{title}</h1>
      <p className="max-w-md leading-8 text-muted-foreground">{description}</p>
      <Button asChild variant="outline">
        <Link href="/">بازگشت به صفحهٔ اصلی</Link>
      </Button>
    </Container>
  );
}
