import Link from "next/link";
import { Button } from "@/components/ui/button";
import { homeContent } from "@/content/home";
import { toPersianDigits } from "@/lib/format";

export function AboutTeaser() {
  const { title, body } = homeContent.about;
  return (
    <div className="grid items-center gap-8 rounded-2xl border bg-surface p-6 shadow-card sm:p-10 md:grid-cols-[auto_1fr]">
      <div className="mx-auto flex size-36 flex-col items-center justify-center rounded-full border-[6px] border-brand-green bg-brand-yellow text-brand-black">
        <span className="text-xs font-bold tracking-widest">ESTD</span>
        <span className="text-4xl font-black">{toPersianDigits(2021)}</span>
      </div>
      <div className="space-y-4 text-center md:text-start">
        <h2 className="text-2xl font-black">{title}</h2>
        <p className="leading-8 text-muted-foreground">{body}</p>
        <Button asChild variant="outline">
          <Link href="/about">بیشتر بخوانید</Link>
        </Button>
      </div>
    </div>
  );
}
