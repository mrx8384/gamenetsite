"use client";

import { type DiscountFormData } from "./discount-form-data";
export type { DiscountFormData } from "./discount-form-data";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { JalaliDateTimeInput } from "@/components/ui/jalali-datetime-input";
import { Label } from "@/components/ui/label";
import { saveDiscountCode } from "@/features/discounts/admin-actions";
import { DISCOUNT_SCOPES, SCOPE_LABELS } from "@/features/discounts/rules";
import { tehranInputToIso } from "@/features/tournaments/time";
import { cn } from "@/lib/utils";


const empty: DiscountFormData = { code: "", title: "", kind: "PERCENT", value: "", maxDiscountToman: "", minAmountToman: "", scopes: [...DISCOUNT_SCOPES], startsAt: "", endsAt: "", usageLimit: "", perUserLimit: "1", isActive: true };

function randomCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return "ATOM" + Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => chars[b % chars.length]).join("");
}


export function DiscountDialog({ initial, trigger }: { initial?: DiscountFormData; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState<DiscountFormData>(initial ?? empty);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, start] = React.useTransition();
  const err = (k: string) => (errors[k] ? <p role="alert" className="text-xs font-medium text-destructive">{errors[k]}</p> : null);
  const set = (p: Partial<DiscountFormData>) => setV((x) => ({ ...x, ...p }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await saveDiscountCode(initial?.id ?? null, { ...v, startsAt: tehranInputToIso(v.startsAt), endsAt: tehranInputToIso(v.endsAt) });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      toast.success(res.message);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setV(initial ?? { ...empty, code: randomCode() }); setErrors({}); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "ویرایش کد تخفیف" : "کد تخفیف جدید"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="d-code">کد</Label>
            <div className="flex gap-2">
              <Input id="d-code" dir="ltr" className="min-w-0 flex-1 font-mono uppercase" value={v.code} onChange={(e) => set({ code: e.target.value })} maxLength={40} aria-invalid={!!errors.code} />
              <Button type="button" variant="outline" onClick={() => set({ code: randomCode() })}>کد تصادفی</Button>
            </div>
            {err("code")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="d-title">عنوان (برای خودتان و نمایش به مشتری، اختیاری)</Label>
            <Input id="d-title" value={v.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} placeholder="مثلاً تخفیف افتتاحیه" />
          </div>
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="mb-1.5 text-sm font-medium">نوع تخفیف</legend>
            {(["PERCENT", "FIXED"] as const).map((k) => (
              <label key={k} className={cn("flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm", v.kind === k && "border-brand-green ring-2 ring-brand-green/25")}>
                <input type="radio" name="d-kind" checked={v.kind === k} onChange={() => set({ kind: k })} className="size-4 accent-[var(--brand-green-dark)]" />
                {k === "PERCENT" ? "درصدی" : "مبلغ ثابت"}
              </label>
            ))}
          </fieldset>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="d-value">{v.kind === "PERCENT" ? "درصد تخفیف (۱ تا ۱۰۰)" : "مبلغ تخفیف (تومان)"}</Label>
              <Input id="d-value" inputMode="numeric" dir="ltr" className="text-start" value={v.value} onChange={(e) => set({ value: e.target.value })} aria-invalid={!!errors.value} />
              {err("value")}
            </div>
            {v.kind === "PERCENT" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="d-max">سقف تخفیف (تومان، اختیاری)</Label>
                <Input id="d-max" inputMode="numeric" dir="ltr" className="text-start" value={v.maxDiscountToman} onChange={(e) => set({ maxDiscountToman: e.target.value })} aria-invalid={!!errors.maxDiscountToman} />
                {err("maxDiscountToman")}
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <Label htmlFor="d-min">حداقل مبلغ خرید (تومان، اختیاری)</Label>
              <Input id="d-min" inputMode="numeric" dir="ltr" className="text-start" value={v.minAmountToman} onChange={(e) => set({ minAmountToman: e.target.value })} aria-invalid={!!errors.minAmountToman} />
              {err("minAmountToman")}
            </div>
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-sm font-medium">قابل استفاده در</legend>
            <div className="flex flex-wrap gap-2">
              {DISCOUNT_SCOPES.map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <input type="checkbox" checked={v.scopes.includes(s)} onChange={(e) => set({ scopes: e.target.checked ? [...v.scopes, s] : v.scopes.filter((x) => x !== s) })} className="size-4 accent-[var(--brand-green-dark)]" />
                  {SCOPE_LABELS[s]}
                </label>
              ))}
            </div>
            {err("scopes")}
          </fieldset>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="d-start">شروع اعتبار (اختیاری)</Label>
              <JalaliDateTimeInput id="d-start" value={v.startsAt} onChange={(x) => set({ startsAt: x })} defaultTime="00:00" />
              {err("startsAt")}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="d-end">پایان اعتبار (اختیاری)</Label>
              <JalaliDateTimeInput id="d-end" value={v.endsAt} onChange={(x) => set({ endsAt: x })} defaultTime="23:59" aria-invalid={!!errors.endsAt} />
              {err("endsAt")}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="d-limit">تعداد کل دفعات استفاده (خالی = نامحدود)</Label>
              <Input id="d-limit" inputMode="numeric" dir="ltr" className="text-start" value={v.usageLimit} onChange={(e) => set({ usageLimit: e.target.value })} aria-invalid={!!errors.usageLimit} />
              {err("usageLimit")}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="d-per">دفعات برای هر کاربر (خالی = نامحدود)</Label>
              <Input id="d-per" inputMode="numeric" dir="ltr" className="text-start" value={v.perUserLimit} onChange={(e) => set({ perUserLimit: e.target.value })} aria-invalid={!!errors.perUserLimit} />
              {err("perUserLimit")}
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={v.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="size-4 accent-[var(--brand-green-dark)]" />
            فعال
          </label>
          <DialogFooter><Button type="submit" loading={pending}>ذخیره</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
