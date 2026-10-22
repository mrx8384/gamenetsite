import type { Metadata } from "next";
import { Gamepad } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "تست دسته" };

// Interim page — replaced in Phase 11.
export default function Page() {
  return <ComingSoon icon={Gamepad} title="تست دسته" description="ابزار تست دسته برای همکاران دارای اشتراک فعال، به‌زودی در دسترس قرار می‌گیرد." />;
}
