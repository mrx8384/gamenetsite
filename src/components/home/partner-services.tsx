import Link from "next/link";
import { Gamepad2, LayoutDashboard, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { homeContent } from "@/content/home";
import { SectionHeading } from "./section-heading";

const icons = [LayoutDashboard, Gamepad2, Trophy];

export function PartnerServices() {
  const { title, subtitle, points } = homeContent.partners;
  return (
    <>
      <SectionHeading title={title} subtitle={subtitle} />
      <div className="grid gap-4 md:grid-cols-3">
        {points.map((p, i) => {
          const Icon = icons[i % icons.length];
          return (
            <div key={p.title} className="rounded-xl border bg-surface p-6 shadow-card">
              <span className="mb-4 flex size-11 items-center justify-center rounded-lg bg-brand-green/15 text-brand-green-deep">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mb-1.5 font-bold">{p.title}</h3>
              <p className="text-sm leading-7 text-muted-foreground">{p.body}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-6">
        <Button asChild variant="strong">
          <Link href="/partners">درخواست همکاری</Link>
        </Button>
      </div>
    </>
  );
}
