import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Suspense } from "react";
import Link from "next/link";
import { Clock, Gamepad, Lock } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GamepadTester } from "@/components/gamepad-tester/gamepad-tester";
import { canUseGamepadTester, getGamepadAccess, type GamepadAccess } from "@/features/gamepad-tester/access";
import { getSiteSettings } from "@/features/settings/site";
import { getCurrentUser } from "@/lib/auth/dal";

export const metadata: Metadata = pageMetadata({ title: "تست دسته (Gamepad Tester)", description: "تست آنلاین دسته‌های PS4، PS5 و Xbox در مرورگر: دکمه‌ها، آنالوگ، دریفت و لرزش — ابزار ویژهٔ همکاران اتم گیم کلاب.", path: "/tournaments/gamepad-tester" });

export default async function GamepadTesterPage() {
  const t = await getSiteSettings("tournaments");
  return (
    <Container className="flex flex-1 flex-col items-center gap-6 py-12 text-center sm:py-16">
      <span className="flex size-16 items-center justify-center rounded-full bg-brand-green/15 text-brand-green-deep">
        <Gamepad className="size-8" aria-hidden />
      </span>
      <Badge variant="strong">ویژهٔ همکاران</Badge>
      <h1 className="text-3xl font-black sm:text-4xl">تست دسته</h1>
      <p className="max-w-lg leading-8 text-muted-foreground">{t.gamepadTesterText}</p>
      <Suspense fallback={<Skeleton className="h-36 w-full max-w-lg rounded-xl" />}>
        <AccessPanel locked={t.gamepadLockedText} granted={t.gamepadGrantedText} />
      </Suspense>
    </Container>
  );
}

const STATE_TEXT: Record<Exclude<GamepadAccess, "granted" | "admin">, { note: string; cta?: { href: string; label: string } }> = {
  anonymous: { note: "برای بررسی دسترسی وارد حساب کاربری شوید.", cta: { href: "/login?next=%2Ftournaments%2Fgamepad-tester", label: "ورود به حساب" } },
  "no-application": { note: "ابتدا درخواست همکاری ثبت کنید.", cta: { href: "/partners", label: "درخواست همکاری" } },
  pending: { note: "درخواست همکاری شما در حال بررسی است.", cta: { href: "/partner", label: "پنل همکار" } },
  rejected: { note: "درخواست همکاری شما رد شده است؛ می‌توانید آن را اصلاح و دوباره ارسال کنید.", cta: { href: "/partner", label: "پنل همکار" } },
  suspended: { note: "حساب همکاری شما تعلیق شده است.", cta: { href: "/contact", label: "تماس با ما" } },
  "no-subscription": { note: "برای استفاده از این ابزار به اشتراک فعال نیاز دارید.", cta: { href: "/partner", label: "پنل همکار" } },
};

async function AccessPanel({ locked }: { locked: string; granted: string }) {
  const access = await getGamepadAccess(await getCurrentUser());

  if (canUseGamepadTester(access)) {
    return (
      <section aria-label="ابزار تست دسته" className="w-full max-w-5xl">
        <GamepadTester />
      </section>
    );
  }
  if (access === "granted" || access === "admin") {
    return (
      <p className="flex items-center gap-2 rounded-xl border bg-surface p-6 text-sm text-muted-foreground"><Clock className="size-4" /> ابزار تست به‌زودی فعال می‌شود.</p>
    );
  }

  const s = STATE_TEXT[access];
  return (
    <section aria-label="وضعیت دسترسی" className="w-full max-w-lg space-y-3 rounded-xl border bg-surface p-6">
      <p className="flex items-center justify-center gap-2 font-bold"><Lock className="size-5" /> {locked}</p>
      <p className="text-sm text-muted-foreground">{s.note}</p>
      {s.cta ? <Button asChild variant="strong"><Link href={s.cta.href}>{s.cta.label}</Link></Button> : null}
    </section>
  );
}
