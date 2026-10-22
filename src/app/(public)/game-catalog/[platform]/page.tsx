import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Gamepad2 } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

const PLATFORMS = ["ps4", "ps5"] as const;

export function generateStaticParams() {
  return PLATFORMS.map((platform) => ({ platform }));
}

export async function generateMetadata({ params }: PageProps<"/game-catalog/[platform]">): Promise<Metadata> {
  const { platform } = await params;
  return { title: `کاتالوگ بازی‌های ${platform.toUpperCase()}` };
}

// Interim page — replaced in Phase 9.
export default async function Page({ params }: PageProps<"/game-catalog/[platform]">) {
  const { platform } = await params;
  if (!(PLATFORMS as readonly string[]).includes(platform)) notFound();
  return (
    <ComingSoon
      icon={Gamepad2}
      title={`بازی‌های ${platform.toUpperCase()}`}
      description="کاتالوگ بازی‌ها در حال انتقال به سایت جدید است و به‌زودی در دسترس خواهد بود."
    />
  );
}
