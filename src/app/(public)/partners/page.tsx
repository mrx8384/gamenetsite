import type { Metadata } from "next";
import { Handshake } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "همکاران" };

// Interim page — replaced in Phase 10.
export default function Page() {
  return <ComingSoon icon={Handshake} title="همکاران" description="ثبت‌نام همکاران و پنل اختصاصی به‌زودی فعال می‌شود." />;
}
