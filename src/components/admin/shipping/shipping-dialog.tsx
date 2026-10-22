"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveShippingMethod } from "@/features/shipping/admin-actions";
import { formatNumber } from "@/lib/format";
import { parseTomanToRial } from "@/lib/text";
import { cn } from "@/lib/utils";

export interface ShippingFormData {
  id?: string;
  name: string;
  description: string;
  type: "PREPAID" | "COLLECT";
  priceToman: string;
  trackingUrl: string;
  isActive: boolean;
  sortOrder: number;
}

const empty: ShippingFormData = { name: "", description: "", type: "COLLECT", priceToman: "0", trackingUrl: "", isActive: true, sortOrder: 0 };

export function ShippingDialog({ method, trigger }: { method?: ShippingFormData; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState<ShippingFormData>(method ?? empty);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const err = (k: string) => (errors[k] ? <p role="alert" className="text-xs font-medium text-destructive">{errors[k]}</p> : null);
  const price = parseTomanToRial(v.priceToman || "0");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveShippingMethod(method?.id ?? null, v);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      toast.success(res.message);
      setOpen(false);
      if (!method) setV(empty);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setV(method ?? empty); setErrors({}); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{method ? "ویرایش روش ارسال" : "روش ارسال جدید"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="s-name">نام شرکت یا روش ارسال</Label>
            <Input id="s-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="مثلاً تیپاکس، باربری، پیک" aria-invalid={!!errors.name} />
            {err("name")}
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-sm font-medium">نوع پرداخت هزینهٔ ارسال</legend>
            {(["COLLECT", "PREPAID"] as const).map((t) => (
              <label key={t} className={cn("flex cursor-pointer gap-3 rounded-xl border p-3 text-sm", v.type === t && "border-brand-green ring-2 ring-brand-green/25")}>
                <input type="radio" name="s-type" checked={v.type === t} onChange={() => setV({ ...v, type: t })} className="mt-1 size-4 accent-[var(--brand-green-dark)]" />
                <span>
                  <span className="font-semibold">{t === "COLLECT" ? "پس‌کرایه" : "پیش‌کرایه با مبلغ ثابت"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t === "COLLECT" ? "هزینه را شرکت حمل تعیین می‌کند و هنگام تحویل از مشتری می‌گیرد؛ نیازی به درگاه شما ندارد." : "مبلغی که تعیین می‌کنید همراه سفارش از طریق درگاه پرداخت می‌شود."}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          {v.type === "PREPAID" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="s-price">هزینهٔ ارسال (تومان)</Label>
              <Input id="s-price" inputMode="numeric" dir="ltr" className="text-start" value={v.priceToman} onChange={(e) => setV({ ...v, priceToman: e.target.value })} aria-invalid={!!errors.priceToman} />
              <p className="text-xs text-muted-foreground">{price === null ? "عدد معتبر نیست" : price === BigInt(0) ? "رایگان" : `${formatNumber(price / BigInt(10))} تومان`}</p>
              {err("priceToman")}
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="s-desc">توضیح برای مشتری (اختیاری)</Label>
            <Input id="s-desc" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="مثلاً تحویل ۲ تا ۴ روز کاری" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="s-track">لینک پیگیری مرسوله (اختیاری)</Label>
            <Input id="s-track" dir="ltr" className="text-start" value={v.trackingUrl} onChange={(e) => setV({ ...v, trackingUrl: e.target.value })} placeholder="https://example.ir/track?code={code}" aria-invalid={!!errors.trackingUrl} />
            <p className="text-xs text-muted-foreground">به‌جای {"{code}"} کد رهگیری سفارش قرار می‌گیرد.</p>
            {err("trackingUrl")}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="s-sort">ترتیب نمایش</Label>
              <Input id="s-sort" type="number" min={0} dir="ltr" className="text-start" value={v.sortOrder} onChange={(e) => setV({ ...v, sortOrder: Number(e.target.value) || 0 })} />
            </div>
            <label className="flex cursor-pointer items-center gap-2 self-end pb-3 text-sm">
              <input type="checkbox" checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} className="size-4 accent-[var(--brand-green-dark)]" />
              فعال
            </label>
          </div>
          <DialogFooter><Button type="submit" loading={pending}>ذخیره</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
