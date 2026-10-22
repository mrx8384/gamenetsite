import type { Metadata } from "next";
import Link from "next/link";
import { Gamepad, Trophy } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSiteSettings } from "@/features/settings/site";

export const metadata: Metadata = { title: "تورنومنت‌ها" };

// Placeholder by specification: tournament logic (brackets, results) is not implemented yet.
export default async function TournamentsPage() {
  const t = await getSiteSettings("tournaments");
  return (
    <Container className="flex flex-1 flex-col items-center justify-center gap-6 py-20 text-center sm:py-28">
      <span className="flex size-20 items-center justify-center rounded-full bg-brand-yellow text-brand-black">
        <Trophy className="size-9" aria-hidden />
      </span>
      <Badge variant="strong">{t.badge}</Badge>
      <h1 className="text-3xl font-black sm:text-4xl">تورنومنت‌ها</h1>
      <p className="text-lg font-semibold">{t.comingSoon}</p>
      <Button asChild variant="outline">
        <Link href="/tournaments/gamepad-tester">
          <Gamepad /> تست دسته (ویژهٔ همکاران)
        </Link>
      </Button>
    </Container>
  );
}
