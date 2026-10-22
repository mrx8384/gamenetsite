import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Clock, Gamepad, Lock, ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getGamepadAccess, type GamepadAccess } from "@/features/gamepad-tester/access";
import { getSiteSettings } from "@/features/settings/site";
import { getCurrentUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "تست دسته", description: "ابزار تست دسته (Gamepad Tester) ویژهٔ همکاران آتم" };

// Placeholder by specification: no testing functionality until detailed specs arrive.
export default async function GamepadTesterPage() {
  const t = await getSiteSettings("tournaments");
  return (
    <Container className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center sm:py-24">
      <span className="flex size-20 items-center justify-center rounded-full bg-brand-green/15 text-brand-green-deep">
        <Gamepad className="size-9" aria-hidden />
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

const STATE_TEXT: Record<Exclude<GamepadAccess, "granted">, { note: string; cta?: { href: string; label: string } }> = {
  anonymous: { note: "برای بررسی دسترسی وارد حساب کاربری شوید.", cta: { href: "/login?next=%2Ftournaments%2Fgamepad-tester", label: "ورود به حساب" } },
  admin: { note: "حساب مدیر به‌صورت خودکار به امکانات همکاران دسترسی ندارد.", cta: { href: "/admin/partners", label: "مدیریت همکاران" } },
  "no-application": { note: "ابتدا درخواست همکاری ثبت کنید.", cta: { href: "/partners", label: "درخواست همکاری" } },
  pending: { note: "درخواست همکاری شما در حال بررسی است.", cta: { href: "/partner", label: "پنل همکار" } },
  rejected: { note: "درخواست همکاری شما رد شده است؛ می‌توانید آن را اصلاح و دوباره ارسال کنید.", cta: { href: "/partner", label: "پنل همکار" } },
  suspended: { note: "حساب همکاری شما تعلیق شده است.", cta: { href: "/contact", label: "تماس با ما" } },
  "no-subscription": { note: "برای استفاده از این ابزار به اشتراک فعال نیاز دارید.", cta: { href: "/partner", label: "پنل همکار" } },
};

async function AccessPanel({ locked, granted }: { locked: string; granted: string }) {
  const access = await getGamepadAccess(await getCurrentUser());

  if (access === "granted") {
    return (
      <section aria-label="ابزار تست دسته" className="w-full max-w-lg space-y-3 rounded-xl border border-brand-green/40 bg-success-soft p-6">
        <p className="flex items-center justify-center gap-2 font-bold text-success"><ShieldCheck className="size-5" /> دسترسی شما فعال است</p>
        <p className="text-sm leading-7">{granted}</p>
        {/* Tool area intentionally disabled (GAMEPAD_TESTER_ENABLED = false). */}
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed bg-surface/70 p-6 text-sm text-muted-foreground" aria-disabled>
          <Clock className="size-4" /> ابزار تست به‌زودی
        </div>
      </section>
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
