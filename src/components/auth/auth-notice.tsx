import { Megaphone } from "lucide-react";
import { getSiteSettings } from "@/features/settings/site";
import { cn } from "@/lib/utils";

/**
 * Notice above the login / register / reset forms (Admin → تنظیمات سایت → اطلاعیهٔ ورود و ثبت‌نام),
 * e.g. while SMS or email delivery is down. Cached settings read: updates on save, no request-time work.
 */
export async function AuthNotice({ page }: { page: "register" | "login" | "reset" }) {
  const n = await getSiteSettings("authNotice");
  const text = n[page].trim();
  if (!text) return null;
  const info = n.tone.trim().toLowerCase() === "info";
  return (
    <div
      role="status"
      className={cn(
        "mb-5 flex gap-3 rounded-xl border p-4 text-sm leading-7",
        info ? "border-info/25 bg-info-soft" : "border-warning/30 bg-warning-soft",
      )}
    >
      <Megaphone className={cn("mt-1 size-4 shrink-0", info ? "text-info" : "text-warning")} aria-hidden />
      <div className="min-w-0">
        {n.title.trim() ? <p className="font-bold">{n.title}</p> : null}
        <p className="whitespace-pre-line text-foreground/80">{text}</p>
      </div>
    </div>
  );
}
