"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JalaliDateTimeInput } from "@/components/ui/jalali-datetime-input";
import { Label } from "@/components/ui/label";
import { addClosure, removeClosure, saveBookingConfig } from "@/features/booking/admin-actions";
import type { BookingConfig } from "@/features/booking/schemas";

function useRun() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      if (res.message) toast.success(res.message);
      after?.();
      router.refresh();
    });
  return { pending, run };
}

export function ClosuresForm({ closures }: { closures: { id: string; label: string; reason: string | null }[] }) {
  const { pending, run } = useRun();
  const [when, setWhen] = React.useState("");
  const [reason, setReason] = React.useState("");
  return (
    <div className="space-y-3">
      <form
        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addClosure({ date: when.slice(0, 10), reason }), () => { setWhen(""); setReason(""); });
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="cl-day">روز تعطیل</Label>
          <JalaliDateTimeInput id="cl-day" value={when} onChange={setWhen} placeholder="انتخاب روز" defaultTime="12:00" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cl-reason">علت (اختیاری، به مشتری نمایش داده می‌شود)</Label>
          <Input id="cl-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="مثلاً تعطیل رسمی" />
        </div>
        <Button type="submit" disabled={!when || pending}>افزودن</Button>
      </form>
      {closures.length ? (
        <ul className="flex flex-wrap gap-2">
          {closures.map((c) => (
            <li key={c.id} className="flex items-center gap-1 rounded-full border bg-surface py-1 ps-3 pe-1 text-sm">
              {c.label}{c.reason ? <span className="text-xs text-muted-foreground"> — {c.reason}</span> : null}
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`حذف ${c.label}`} disabled={pending} onClick={() => run(() => removeClosure(c.id))}><X /></Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">روز تعطیلی ثبت نشده است.</p>
      )}
    </div>
  );
}

export function BookingConfigForm({ initial }: { initial: BookingConfig }) {
  const { pending, run } = useRun();
  const [v, setV] = React.useState(initial);
  const num = (k: keyof BookingConfig, label: string, hint: string, min: number, max: number) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`cfg-${k}`}>{label}</Label>
      <Input id={`cfg-${k}`} type="number" min={min} max={max} dir="ltr" className="text-start" value={String(v[k])} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveBookingConfig(v));
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {num("daysAhead", "چند روز آینده قابل رزرو باشد", "مثلاً ۳۰ = از امروز تا ۳۰ روز بعد.", 1, 180)}
        {num("minHoursBefore", "بستن رزرو چند ساعت قبل از شروع شیفت", "مثلاً ۲ = تا ۲ ساعت قبل از شروع.", 0, 72)}
        {num("paymentMinutes", "مهلت پرداخت آنلاین (دقیقه)", "تا این مدت شیفت برای کسی که در حال پرداخت است نگه داشته می‌شود.", 5, 60)}
        {num("maxGuests", "حداکثر تعداد نفرات", "سقف عددی که مشتری می‌تواند وارد کند.", 1, 1000)}
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={v.askGuests} onChange={(e) => setV({ ...v, askGuests: e.target.checked })} className="size-4 accent-[var(--brand-green-dark)]" />
        تعداد نفرات از مشتری پرسیده شود
      </label>
      <Button type="submit" className="justify-self-start" loading={pending}>ذخیرهٔ تنظیمات</Button>
    </form>
  );
}
