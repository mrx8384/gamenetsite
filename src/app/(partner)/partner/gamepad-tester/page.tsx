import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { GamepadTools } from "@/components/gamepad-tester/gamepad-tools";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { canUseGamepadTester, getGamepadAccess } from "@/features/gamepad-tester/access";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "تست دسته", robots: { index: false } };

/** The gamepad tester inside the partner area (carries the partner's own look). */
export default function PartnerGamepadTesterPage() {
  return (
    <Container className="space-y-6 py-8 sm:py-12">
      <h1 className="text-2xl font-black">تست دسته</h1>
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <Tester />
      </Suspense>
    </Container>
  );
}

async function Tester() {
  const user = await requireUser("/partner/gamepad-tester");
  const access = await getGamepadAccess(user);
  if (canUseGamepadTester(access)) return <GamepadTools />;
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border bg-surface p-6 text-sm">
      <p className="flex items-center gap-2 font-medium"><Lock className="size-4" aria-hidden /> برای استفاده از تست دسته به اشتراک فعال نیاز دارید.</p>
      <Button asChild variant="outline"><Link href="/partner">پنل همکار</Link></Button>
    </div>
  );
}
