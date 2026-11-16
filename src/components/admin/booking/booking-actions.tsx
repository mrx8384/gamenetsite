"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { markBookingRefunded, saveBookingNote, setBookingStatus } from "@/features/booking/admin-actions";
import type { BookingStatusKey } from "@/features/booking/rules";

const LABEL: Partial<Record<BookingStatusKey, string>> = { COMPLETED: "آمد", NO_SHOW: "نیامد", CANCELLED: "لغو", CONFIRMED: "برگرداندن به قطعی" };

export function BookingActions({ id, allowed, refundNeeded, note, paid }: { id: string; allowed: BookingStatusKey[]; refundNeeded: boolean; note: string; paid: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [text, setText] = React.useState(note);
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      if (res.message) toast.success(res.message);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {allowed.map((to) => (
        <Button
          key={to}
          size="sm"
          variant={to === "CANCELLED" ? "outline" : to === "COMPLETED" ? "secondary" : "ghost"}
          className={to === "CANCELLED" ? "text-destructive" : undefined}
          disabled={pending}
          onClick={() => {
            if (to === "CANCELLED" && !window.confirm(paid ? "رزرو لغو شود؟ مبلغ پرداختی در فهرست بازگشت وجه قرار می‌گیرد." : "رزرو لغو شود؟")) return;
            run(() => setBookingStatus({ id, to }));
          }}
        >
          {LABEL[to]}
        </Button>
      ))}
      {refundNeeded ? <Button size="sm" variant="strong" disabled={pending} onClick={() => run(() => markBookingRefunded(id))}>وجه برگردانده شد</Button> : null}
      <form
        className="flex min-w-0 basis-full gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveBookingNote(id, text));
        }}
      >
        <Input aria-label="یادداشت داخلی" placeholder="یادداشت داخلی (فقط مدیر)" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} className="h-8 min-w-0 flex-1 text-xs" />
        {text !== note ? <Button size="sm" variant="outline" type="submit" disabled={pending}>ذخیره</Button> : null}
      </form>
    </div>
  );
}
