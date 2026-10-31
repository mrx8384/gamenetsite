import { Suspense } from "react";
import { SectionGate } from "@/components/layout/section-gate";

/** Hidden from visitors when the admin turns the section off (Admin → تنظیمات سایت → نمایش بخش‌ها). */
export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <SectionGate section="news">{children}</SectionGate>
    </Suspense>
  );
}
