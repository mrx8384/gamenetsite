import type { Metadata } from "next";
import { Gamepad2 } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "کاتالوگ بازی‌ها" };

// Interim page — replaced in Phase 9.
export default function Page() {
  return <ComingSoon icon={Gamepad2} title="کاتالوگ بازی‌ها" description="کاتالوگ بازی‌های PS4 و PS5 در حال انتقال به سایت جدید است." />;
}
