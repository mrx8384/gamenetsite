import { notFound } from "next/navigation";
import { EyeOff } from "lucide-react";
import { getSectionVisibility } from "@/features/settings/sections";
import { SECTION_DEFS, type SectionKey } from "@/features/settings/sections-schema";
import { getCurrentUser } from "@/lib/auth/dal";
import { Container } from "./container";

/**
 * Hides a whole section when the admin turned it off in Admin → تنظیمات سایت → نمایش بخش‌ها:
 * visitors get the 404 page, admins still see it with a notice (to check it before showing it again).
 * A visible section reads only cached settings, so it stays part of the prerendered shell.
 */
export async function SectionGate({ section, children }: { section: SectionKey; children: React.ReactNode }) {
  const visibility = await getSectionVisibility();
  if (visibility[section]) return children;
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") notFound();
  const label = SECTION_DEFS.find((s) => s.key === section)?.label ?? section;
  return (
    <>
      <Container className="pt-4">
        <p role="status" className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
          <EyeOff className="size-4 shrink-0" aria-hidden />
          {`بخش «${label}» برای کاربران مخفی است؛ فقط شما (مدیر) آن را می‌بینید.`}
        </p>
      </Container>
      {children}
    </>
  );
}
