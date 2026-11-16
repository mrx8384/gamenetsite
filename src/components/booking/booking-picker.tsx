"use client";

import * as React from "react";
import { toast } from "sonner";
import { Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { bookShift } from "@/features/booking/actions";
import { amountToPayNow, dayLabel, formatDayLong, PAYMENT_MODE_LABELS, shiftRange, type PaymentMode } from "@/features/booking/rules";
import type { PublicSlot } from "@/features/booking/queries";
import { checkDiscountCode, type CodePreview } from "@/features/discounts/actions";
import { formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Day {
  day: string;
  closedReason: string | null;
  slots: PublicSlot[];
}

const STATE_TEXT = { full: "تکمیل", closed: "تعطیل", past: "گذشته" } as const;

export function BookingPicker({
  calendar,
  askGuests,
  maxGuests,
  onlinePayment,
  defaults,
}: {
  calendar: Day[];
  askGuests: boolean;
  maxGuests: number;
  onlinePayment: boolean;
  /** null = visitor not logged in (can browse, cannot book). */
  defaults: { name: string; phone: string } | null;
}) {
  const firstOpen = calendar.find((d) => d.slots.some((s) => s.state === "open"))?.day ?? calendar[0]?.day ?? "";
  const [day, setDay] = React.useState(firstOpen);
  const [shiftId, setShiftId] = React.useState<string | null>(null);
  const [name, setName] = React.useState(defaults?.name ?? "");
  const [phone, setPhone] = React.useState(defaults?.phone ?? "");
  const [guests, setGuests] = React.useState("");
  const [note, setNote] = React.useState("");
  const [codeInput, setCodeInput] = React.useState("");
  const [code, setCode] = React.useState<CodePreview | null>(null);
  const [pending, start] = React.useTransition();
  const [checking, startChecking] = React.useTransition();

  const current = calendar.find((d) => d.day === day);
  const slot = current?.slots.find((s) => s.shiftId === shiftId && s.state === "open") ?? null;
  const price = slot ? BigInt(slot.price) : BigInt(0);
  const discount = code && slot ? BigInt(code.discount) : BigInt(0);
  const total = price - discount;
  const payNow = slot ? amountToPayNow(total, onlinePayment ? slot.paymentMode : "ON_SITE", slot.depositPercent) : BigInt(0);

  function pickDay(d: string) {
    setDay(d);
    setShiftId(null);
    setCode(null);
  }

  function applyCode() {
    if (!slot) return;
    startChecking(async () => {
      const res = await checkDiscountCode({ code: codeInput, scope: "BOOKING", amount: slot.price });
      if (!res.ok) {
        setCode(null);
        return void toast.error(res.error);
      }
      setCode(res.data);
      toast.success(`کد «${res.data.title}» اعمال شد.`);
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!slot) return;
    start(async () => {
      const res = await bookShift({ date: day, shiftId: slot.shiftId, name, phone, guests: askGuests && guests ? guests : null, note, discountCode: code?.code ?? "" });
      if (!res.ok) return void toast.error(res.error);
      if (res.message) toast.success(res.message);
      window.location.assign(res.data.redirectTo);
    });
  }

  return (
    <div className="space-y-5">
      <section aria-labelledby="pick-day" className="space-y-2">
        <h2 id="pick-day" className="font-bold">۱. روز را انتخاب کنید</h2>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="radiogroup" aria-label="روز رزرو">
          {calendar.map((d) => {
            const l = dayLabel(d.day);
            const open = d.slots.some((s) => s.state === "open");
            return (
              <button
                key={d.day}
                type="button"
                role="radio"
                aria-checked={day === d.day}
                onClick={() => pickDay(d.day)}
                className={cn(
                  "flex min-w-20 shrink-0 flex-col items-center rounded-xl border bg-surface px-3 py-2 text-sm transition-colors",
                  day === d.day ? "border-brand-green-dark bg-success-soft ring-2 ring-brand-green/30" : "hover:bg-secondary",
                  !open && "opacity-60",
                )}
              >
                <span className="text-xs text-muted-foreground">{l.weekday}</span>
                <span className="font-bold">{l.date}</span>
                <span className={cn("text-[11px]", open ? "text-success" : "text-muted-foreground")}>{d.closedReason !== null ? "تعطیل" : open ? "خالی دارد" : d.slots.length ? "پر" : "—"}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="pick-shift" className="space-y-2">
        <h2 id="pick-shift" className="font-bold">۲. شیفت {current ? `— ${formatDayLong(current.day)}` : ""}</h2>
        {current?.closedReason !== null && current?.closedReason !== undefined ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">مجموعه در این روز رزرو نمی‌پذیرد{current.closedReason ? ` (${current.closedReason})` : ""}.</p>
        ) : !current || current.slots.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">برای این روز شیفتی تعریف نشده است.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="شیفت">
            {current.slots.map((s) => {
              const disabled = s.state !== "open";
              const mode = (onlinePayment ? s.paymentMode : "ON_SITE") as PaymentMode;
              return (
                <button
                  key={s.shiftId}
                  type="button"
                  role="radio"
                  aria-checked={shiftId === s.shiftId}
                  disabled={disabled}
                  onClick={() => { setShiftId(s.shiftId); setCode(null); }}
                  className={cn(
                    "rounded-xl border bg-surface p-4 text-start text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-55",
                    shiftId === s.shiftId ? "border-brand-green-dark ring-2 ring-brand-green/30" : !disabled && "hover:bg-secondary",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-bold">{s.title}</span>
                    {disabled ? <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{STATE_TEXT[s.state as keyof typeof STATE_TEXT]}</span> : s.capacity > 1 ? <span className="text-xs text-success">{s.left.toLocaleString("fa-IR")} جای خالی</span> : null}
                  </span>
                  <span className="mt-1 flex items-center gap-1 text-muted-foreground"><Clock className="size-3.5" aria-hidden /> {shiftRange(s.startMinute, s.endMinute)}</span>
                  <span className="mt-1 block font-semibold">{BigInt(s.price) === BigInt(0) ? "رایگان" : formatToman(BigInt(s.price))}</span>
                  <span className="block text-xs text-muted-foreground">{PAYMENT_MODE_LABELS[mode]}{mode === "DEPOSIT" && s.depositPercent ? ` (${s.depositPercent.toLocaleString("fa-IR")}٪)` : ""}</span>
                  {s.description ? <span className="mt-1 block text-xs leading-6 text-muted-foreground">{s.description}</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {slot && defaults ? (
        <form onSubmit={submit} className="space-y-4 rounded-xl border bg-surface p-4" aria-labelledby="book-form">
          <h2 id="book-form" className="font-bold">۳. مشخصات رزرو</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="b-name">نام رزروکننده</Label>
              <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="b-phone">شمارهٔ تماس</Label>
              <Input id="b-phone" dir="ltr" inputMode="tel" className="text-start" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} required placeholder="09121234567" />
            </div>
            {askGuests ? (
              <div className="grid gap-1.5">
                <Label htmlFor="b-guests"><Users className="me-1 inline size-4" aria-hidden />تعداد نفرات (تقریبی)</Label>
                <Input id="b-guests" type="number" min={1} max={maxGuests} dir="ltr" className="text-start" value={guests} onChange={(e) => setGuests(e.target.value)} />
              </div>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="b-note">توضیحات (اختیاری)</Label>
            <Textarea id="b-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً مناسبت، درخواست کیک یا تزئین" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="b-code">کد تخفیف (اختیاری)</Label>
            {code ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-success-soft p-3 text-sm">
                <span>🎟️ {code.title} — {formatToman(BigInt(code.discount))} تخفیف</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCode(null)}>حذف کد</Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input id="b-code" dir="ltr" className="min-w-0 flex-1 font-mono" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} maxLength={40} autoComplete="off" />
                <Button type="button" variant="outline" loading={checking} disabled={codeInput.trim().length < 3} onClick={applyCode}>اعمال</Button>
              </div>
            )}
          </div>
          <dl className="grid gap-1 rounded-lg bg-secondary/60 p-3 text-sm">
            <div className="flex justify-between"><dt>مبلغ شیفت</dt><dd>{formatToman(price)}</dd></div>
            {discount > BigInt(0) ? <div className="flex justify-between text-success"><dt>تخفیف</dt><dd>− {formatToman(discount)}</dd></div> : null}
            <div className="flex justify-between font-bold"><dt>جمع</dt><dd>{formatToman(total)}</dd></div>
            <div className="flex justify-between text-muted-foreground"><dt>{payNow > BigInt(0) ? "پرداخت آنلاین الان" : "پرداخت"}</dt><dd>{payNow > BigInt(0) ? formatToman(payNow) : "حضوری در مجموعه"}</dd></div>
          </dl>
          <Button type="submit" variant="strong" loading={pending} className="w-full sm:w-auto">{payNow > BigInt(0) ? `رزرو و پرداخت ${formatToman(payNow)}` : "ثبت رزرو"}</Button>
        </form>
      ) : null}
    </div>
  );
}
