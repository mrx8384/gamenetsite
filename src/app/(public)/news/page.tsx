import type { Metadata } from "next";
import { Newspaper } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "اخبار" };

// Interim page — replaced in Phase 8.
export default function Page() {
  return <ComingSoon icon={Newspaper} title="اخبار" description="بخش اخبار به‌زودی راه‌اندازی می‌شود." />;
}
