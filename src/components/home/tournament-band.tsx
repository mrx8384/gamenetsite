import Link from "next/link";
import { Trophy } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { homeContent } from "@/content/home";

export function TournamentBand() {
  const { title, subtitle } = homeContent.tournaments;
  return (
    <section className="bg-brand-black text-brand-cream">
      <Container className="grid items-center gap-8 py-14 sm:py-16 md:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <Badge variant="accent">به‌زودی</Badge>
          <h2 className="text-2xl font-black sm:text-3xl">{title}</h2>
          <p className="max-w-2xl leading-8 text-brand-cream/70">{subtitle}</p>
          <Button asChild variant="default" className="mt-2">
            <Link href="/tournaments">اطلاعات بیشتر</Link>
          </Button>
        </div>
        <div className="relative mx-auto hidden size-40 items-center justify-center md:flex" aria-hidden>
          <span className="absolute inset-0 rounded-full border border-white/10" />
          <span className="absolute inset-5 rounded-full border border-white/10" />
          <span className="flex size-20 items-center justify-center rounded-full bg-brand-yellow text-brand-black">
            <Trophy className="size-9" />
          </span>
        </div>
      </Container>
    </section>
  );
}
