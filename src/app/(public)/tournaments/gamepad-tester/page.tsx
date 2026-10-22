import type { Metadata } from "next";
import { Gamepad } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";
import { getSiteSettings } from "@/features/settings/site";

export const metadata: Metadata = { title: "تست دسته" };

// Interim page — replaced in Phase 11.
export default async function Page() {
  const t = await getSiteSettings("tournaments");
  return <ComingSoon icon={Gamepad} title="تست دسته" description={t.gamepadTesterText} />;
}
