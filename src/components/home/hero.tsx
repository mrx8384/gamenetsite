import Link from "next/link";
import { Gamepad2, ShoppingBag } from "lucide-react";
import { Logo } from "@/components/logo";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { homeContent } from "@/content/home";

/** Decorative atom orbits around the (unmodified) logo. */
function Orbits() {
  return (
    <svg viewBox="0 0 400 400" className="absolute inset-0 size-full" aria-hidden>
      <g className="origin-center animate-orbit" style={{ transformBox: "fill-box" }}>
        <ellipse cx="200" cy="200" rx="190" ry="78" fill="none" stroke="var(--brand-black)" strokeOpacity="0.12" strokeWidth="1.5" />
        <circle cx="390" cy="200" r="7" fill="var(--brand-green)" />
      </g>
      <g className="origin-center animate-orbit [animation-direction:reverse] [animation-duration:64s]" style={{ transformBox: "fill-box" }}>
        <ellipse cx="200" cy="200" rx="190" ry="78" fill="none" stroke="var(--brand-black)" strokeOpacity="0.12" strokeWidth="1.5" transform="rotate(60 200 200)" />
        <circle cx="105" cy="35.4" r="6" fill="var(--brand-yellow)" stroke="var(--brand-black)" strokeWidth="1.5" />
      </g>
      <g className="origin-center animate-orbit [animation-duration:80s]" style={{ transformBox: "fill-box" }}>
        <ellipse cx="200" cy="200" rx="190" ry="78" fill="none" stroke="var(--brand-black)" strokeOpacity="0.12" strokeWidth="1.5" transform="rotate(-60 200 200)" />
        <circle cx="105" cy="364.6" r="5" fill="var(--brand-black)" />
      </g>
    </svg>
  );
}

export function Hero() {
  const { eyebrow, title, subtitle } = homeContent.hero;
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_20%_40%,color-mix(in_oklab,var(--brand-green)_14%,transparent),transparent_70%),radial-gradient(40%_40%_at_90%_10%,color-mix(in_oklab,var(--brand-yellow)_18%,transparent),transparent_70%)]"
      />
      <Container className="relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.15fr_1fr] lg:gap-6 lg:py-24">
        <div className="animate-rise space-y-6 text-center lg:text-start">
          <p className="inline-flex items-center gap-2 rounded-full border bg-surface/70 px-3.5 py-1.5 text-xs font-semibold">
            <span className="size-2 rounded-full bg-brand-green" aria-hidden />
            {eyebrow}
          </p>
          <h1 className="text-4xl leading-[1.35] font-black sm:text-5xl lg:text-[3.4rem]">{title}</h1>
          <p className="mx-auto max-w-xl text-lg leading-9 text-muted-foreground lg:mx-0">{subtitle}</p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <Button asChild size="lg">
              <Link href="/game-catalog">
                <Gamepad2 /> کاتالوگ بازی‌ها
              </Link>
            </Button>
            <Button asChild size="lg" variant="strong">
              <Link href="/shop">
                <ShoppingBag /> ورود به فروشگاه
              </Link>
            </Button>
          </div>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-[22rem] sm:max-w-[26rem]">
          <Orbits />
          <div className="absolute inset-[22%] flex items-center justify-center rounded-full bg-surface shadow-[0_30px_80px_-30px_rgb(17_17_17/0.35)]">
            <Logo size={240} priority className="h-[92%] w-[92%]" />
          </div>
        </div>
      </Container>
    </section>
  );
}
