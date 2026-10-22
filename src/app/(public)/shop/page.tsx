import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "فروشگاه" };

// Interim page — replaced in Phase 6.
export default function Page() {
  return <ComingSoon icon={ShoppingBag} title="فروشگاه" description="فروشگاه آتم در حال راه‌اندازی است و به‌زودی محصولات منتخب گیمینگ را اینجا خواهید دید." />;
}
