import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  title,
  subtitle,
  href,
  linkLabel = "مشاهدهٔ همه",
  className,
  invert = false,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  className?: string;
  invert?: boolean;
}) {
  return (
    <div className={cn("mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="max-w-2xl space-y-2">
        <h2 className="flex items-center gap-3 text-2xl font-black sm:text-3xl">
          <span className="h-7 w-1.5 rounded-full bg-brand-green" aria-hidden />
          {title}
        </h2>
        {subtitle ? <p className={cn("leading-8", invert ? "text-brand-cream/70" : "text-muted-foreground")}>{subtitle}</p> : null}
      </div>
      {href ? (
        <Link
          href={href}
          className={cn(
            "group inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline",
            invert ? "text-brand-green" : "text-link",
          )}
        >
          {linkLabel}
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
