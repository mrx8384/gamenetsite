import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "تماس با ما" };

// Interim page — replaced in Phase 8.
export default function Page() {
  return <ComingSoon icon={Mail} title="تماس با ما" description="فرم تماس و اطلاعات ارتباطی به‌زودی در این صفحه قرار می‌گیرد." />;
}
