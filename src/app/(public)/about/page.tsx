import type { Metadata } from "next";
import { Info } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "درباره ما" };

// Interim page — replaced in Phase 8.
export default function Page() {
  return <ComingSoon icon={Info} title="درباره ما" description="صفحهٔ معرفی آتم گیم کلاب به‌زودی تکمیل می‌شود." />;
}
