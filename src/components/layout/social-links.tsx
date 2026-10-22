import { cn } from "@/lib/utils";

const NETWORKS = [
  ["instagram", "اینستاگرام"],
  ["telegram", "تلگرام"],
  ["whatsapp", "واتس‌اپ"],
  ["eitaa", "ایتا"],
  ["bale", "بله"],
  ["aparat", "آپارات"],
  ["youtube", "یوتیوب"],
] as const;

/** Social network links from settings (only filled ones are shown). URLs are validated as https on save. */
export function SocialLinks({ contact, className, tone = "light" }: { contact: Partial<Record<(typeof NETWORKS)[number][0], string>>; className?: string; tone?: "light" | "dark" }) {
  const items = NETWORKS.filter(([k]) => contact[k]);
  if (items.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label="شبکه‌های اجتماعی">
      {items.map(([k, label]) => (
        <li key={k}>
          <a
            href={contact[k]}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex rounded-full border px-3 py-1 text-xs transition-colors",
              tone === "dark" ? "border-white/15 text-brand-cream/80 hover:border-brand-green hover:text-brand-green" : "bg-surface hover:border-brand-green hover:text-link",
            )}
          >
            {label}
          </a>
        </li>
      ))}
    </ul>
  );
}
