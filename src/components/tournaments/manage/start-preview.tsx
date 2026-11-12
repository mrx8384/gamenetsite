"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { swapParticipants } from "@/features/tournaments/actions";
import { groupName } from "@/features/tournaments/constants";
import type { StartPreview } from "@/features/tournaments/preview";
import { cn } from "@/lib/utils";

const fa = (n: number) => n.toLocaleString("fa-IR");

/**
 * Before the start: who will meet whom (or the groups), from the current participant order.
 * Tap one player, then another, to swap their places.
 */
export function StartPreviewCard({ preview, names, checkIn }: { preview: StartPreview; names: Record<string, string>; checkIn: boolean }) {
  const router = useRouter();
  const [picked, setPicked] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const pick = (id: string) => {
    if (pending) return;
    if (!picked) return setPicked(id);
    if (picked === id) return setPicked(null);
    const a = picked;
    setPicked(null);
    startTransition(async () => {
      const res = await swapParticipants(a, id);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      router.refresh();
    });
  };

  const chip = (id: string | null, key: string) =>
    id ? (
      <button
        key={key}
        type="button"
        onClick={() => pick(id)}
        aria-pressed={picked === id}
        className={cn(
          "min-w-0 flex-1 cursor-pointer truncate rounded-lg border px-3 py-2 text-start text-sm font-medium transition-colors hover:border-brand-green",
          picked === id ? "border-brand-green bg-primary text-primary-foreground" : picked ? "bg-surface ring-1 ring-brand-green/30" : "bg-surface",
        )}
      >
        {names[id] ?? "—"}
      </button>
    ) : (
      <span key={key} className="flex-1 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground italic">استراحت (صعود مستقیم)</span>
    );

  return (
    <Card className={cn(pending && "opacity-60")}>
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center gap-2 text-base"><ArrowLeftRight className="size-5" /> پیش‌نمایش جدول و جابه‌جایی بازیکنان</CardTitle>
        <p className="text-sm text-muted-foreground">
          جدول با شروع تورنومنت دقیقاً همین‌طور ساخته می‌شود. برای جابه‌جایی، روی یک بازیکن و بعد روی بازیکن دیگر بزنید تا جایشان عوض شود.
          {checkIn ? " (اگر کسی چک‌این نکند، موقع شروع حذف می‌شود و جدول بر اساس بقیه ساخته می‌شود.)" : ""}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {picked ? (
          <p className="flex flex-wrap items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm" role="status">
            «{names[picked]}» انتخاب شد؛ حالا بازیکنی را که باید جایش با او عوض شود انتخاب کنید.
            <Button type="button" size="sm" variant="ghost" onClick={() => setPicked(null)}><X /> انصراف</Button>
          </p>
        ) : null}
        {preview.kind === "pairs" ? (
          <>
            <p className="text-xs font-bold text-muted-foreground">{preview.label}</p>
            <ol className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {preview.pairs.map((p, i) => (
                <li key={i} className="flex items-center gap-2 rounded-xl border bg-secondary/40 p-2">
                  <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">{fa(i + 1)}</span>
                  {chip(p.a, "a")}
                  <span className="shrink-0 text-xs text-muted-foreground">با</span>
                  {chip(p.b, "b")}
                </li>
              ))}
            </ol>
            {preview.bye ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">استراحت این دور:</span>
                <div className="flex w-56">{chip(preview.bye, "bye")}</div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {preview.groups.map((g, gi) => (
              <div key={gi} className="space-y-2 rounded-xl border bg-secondary/40 p-3">
                <p className="text-sm font-bold">{groupName(gi)}</p>
                <div className="flex flex-col gap-1.5">{g.map((id) => chip(id, id))}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
