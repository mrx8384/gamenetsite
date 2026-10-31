"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { saveSectionVisibility } from "@/features/settings/sections-actions";
import { SECTION_DEFS, type SectionVisibility } from "@/features/settings/sections-schema";
import { cn } from "@/lib/utils";

export function SectionsForm({ initial }: { initial: SectionVisibility }) {
  const router = useRouter();
  const [v, setV] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();
  const dirty = SECTION_DEFS.some((s) => v[s.key] !== initial[s.key]);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await saveSectionVisibility(v);
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message);
          router.refresh();
        });
      }}
    >
      <Card>
        <CardContent className="divide-y p-0">
          {SECTION_DEFS.map((s) => {
            const on = v[s.key];
            const id = `section-${s.key}`;
            return (
              <div key={s.key} className="flex items-start gap-4 p-4 sm:p-5">
                <span className={cn("mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full", on ? "bg-brand-green/15 text-brand-green-deep" : "bg-secondary text-muted-foreground")}>
                  {on ? <Eye className="size-5" aria-hidden /> : <EyeOff className="size-5" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <label htmlFor={id} className="cursor-pointer font-bold">{s.label}</label>
                  <p className="text-xs leading-6 text-muted-foreground">{s.hint}</p>
                  {!on ? <a href={s.href} target="_blank" rel="noopener" className="text-xs font-medium text-link hover:underline">پیش‌نمایش (فقط برای مدیر)</a> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2 pt-1.5">
                  <span className={cn("text-xs font-medium", on ? "text-success" : "text-muted-foreground")}>{on ? "نمایش" : "مخفی"}</span>
                  <button
                    id={id}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={`نمایش «${s.label}» به کاربران`}
                    onClick={() => setV({ ...v, [s.key]: !on })}
                    className={cn(
                      "relative h-7 w-12 rounded-full border-2 border-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green",
                      on ? "bg-brand-green" : "bg-muted-foreground/30",
                    )}
                  >
                    <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", on ? "start-[1.4rem]" : "start-0.5")} />
                  </button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending} disabled={!dirty}>ذخیرهٔ تغییرات</Button>
        {dirty ? <span className="text-xs text-muted-foreground">تغییرات هنوز ذخیره نشده‌اند.</span> : null}
      </div>
    </form>
  );
}
