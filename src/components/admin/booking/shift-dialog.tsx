"use client";

import { type ShiftFormData } from "./shift-form-data";
export type { ShiftFormData } from "./shift-form-data";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveShift } from "@/features/booking/admin-actions";
import { PAYMENT_MODE_LABELS, PAYMENT_MODES, WEEKDAY_LABELS } from "@/features/booking/rules";
import { cn } from "@/lib/utils";


const empty: ShiftFormData = { title: "", weekdays: [0, 1, 2, 3, 4, 5, 6], start: "10:00", end: "14:00", capacity: "1", priceToman: "", paymentMode: "DEPOSIT", depositPercent: "30", description: "", isActive: true, sortOrder: "0" };


export function ShiftDialog({ initial, trigger, onlineReady }: { initial?: ShiftFormData; trigger: React.ReactNode; onlineReady: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState<ShiftFormData>(initial ?? empty);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, start] = React.useTransition();
  const set = (p: Partial<ShiftFormData>) => setV((x) => ({ ...x, ...p }));
  const err = (k: string) => (errors[k] ? <p role="alert" className="text-xs font-medium text-destructive">{errors[k]}</p> : null);
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setV(initial ?? empty); setErrors({}); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "ویرایش شیفت" : "شیفت جدید"}</DialogTitle></DialogHeader>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await saveShift(initial?.id ?? null, v);
              if (!res.ok) {
                setErrors(res.fieldErrors ?? {});
                return void toast.error(res.error);
              }
              toast.success(res.message);
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="sh-title">عنوان شیفت</Label>
            <Input id="sh-title" value={v.title} onChange={(e) => set({ title: e.target.value })} maxLength={60} placeholder="مثلاً شیفت صبح، شیفت عصر، شیفت شب" aria-invalid={!!errors.title} />
            {err("title")}
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">روزهای هفته</legend>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_LABELS.map((l, i) => (
                <label key={i} className={cn("cursor-pointer rounded-lg border px-3 py-1.5 text-sm", v.weekdays.includes(i) && "border-brand-green-dark bg-success-soft font-semibold")}>
                  <input type="checkbox" className="sr-only" checked={v.weekdays.includes(i)} onChange={(e) => set({ weekdays: e.target.checked ? [...v.weekdays, i] : v.weekdays.filter((d) => d !== i) })} />
                  {l}
                </label>
              ))}
            </div>
            {err("weekdays")}
          </fieldset>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="sh-start">ساعت شروع</Label>
              <Input id="sh-start" type="time" dir="ltr" className="text-start" value={v.start} onChange={(e) => set({ start: e.target.value })} aria-invalid={!!errors.start} />
              {err("start")}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sh-end">ساعت پایان</Label>
              <Input id="sh-end" type="time" dir="ltr" className="text-start" value={v.end} onChange={(e) => set({ end: e.target.value })} aria-invalid={!!errors.end} />
              {err("end")}
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">اگر پایان قبل از شروع باشد (مثلاً ۱۸:۰۰ تا ۰۲:۰۰)، یعنی شیفت تا بامداد روز بعد ادامه دارد.</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="sh-price">قیمت (تومان)</Label>
              <Input id="sh-price" inputMode="numeric" dir="ltr" className="text-start" value={v.priceToman} onChange={(e) => set({ priceToman: e.target.value })} aria-invalid={!!errors.priceToman} />
              {err("priceToman")}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sh-cap">ظرفیت هم‌زمان</Label>
              <Input id="sh-cap" type="number" min={1} max={100} dir="ltr" className="text-start" value={v.capacity} onChange={(e) => set({ capacity: e.target.value })} aria-invalid={!!errors.capacity} />
              {err("capacity")}
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">ظرفیت ۱ یعنی کل مجموعه در این شیفت به یک نفر رزرو می‌شود.</p>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">نحوهٔ پرداخت</legend>
            {PAYMENT_MODES.map((m) => (
              <label key={m} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm", v.paymentMode === m && "border-brand-green ring-2 ring-brand-green/25")}>
                <input type="radio" name="sh-mode" checked={v.paymentMode === m} onChange={() => set({ paymentMode: m })} className="size-4 accent-[var(--brand-green-dark)]" />
                <span className="flex-1">{PAYMENT_MODE_LABELS[m]}</span>
                {m === "DEPOSIT" && v.paymentMode === "DEPOSIT" ? (
                  <span className="flex items-center gap-1 text-xs">
                    <Input aria-label="درصد بیعانه" type="number" min={1} max={99} dir="ltr" className="h-8 w-16 text-start" value={v.depositPercent} onChange={(e) => set({ depositPercent: e.target.value })} />٪
                  </span>
                ) : null}
              </label>
            ))}
            {!onlineReady && v.paymentMode !== "ON_SITE" ? <p className="text-xs text-warning">درگاه پرداخت فعال نیست؛ تا فعال نشود، این شیفت فقط با تماس رزرو می‌شود.</p> : null}
          </fieldset>
          <div className="grid gap-1.5">
            <Label htmlFor="sh-desc">توضیح برای مشتری (اختیاری)</Label>
            <Input id="sh-desc" value={v.description} onChange={(e) => set({ description: e.target.value })} maxLength={300} placeholder="مثلاً شامل همهٔ دستگاه‌ها و بازی‌ها" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="sh-sort">ترتیب نمایش</Label>
              <Input id="sh-sort" type="number" min={0} dir="ltr" className="text-start" value={v.sortOrder} onChange={(e) => set({ sortOrder: e.target.value })} />
            </div>
            <label className="flex cursor-pointer items-center gap-2 self-end pb-3 text-sm">
              <input type="checkbox" checked={v.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="size-4 accent-[var(--brand-green-dark)]" />
              فعال
            </label>
          </div>
          <DialogFooter><Button type="submit" loading={pending}>ذخیره</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
