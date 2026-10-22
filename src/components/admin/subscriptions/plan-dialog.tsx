"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { savePlan } from "@/features/subscriptions/admin-actions";
import { ENTITLEMENT_KEYS, ENTITLEMENTS, type EntitlementKey } from "@/features/subscriptions/constants";
import { formatNumber } from "@/lib/format";
import { parseTomanToRial } from "@/lib/text";

export interface PlanFormData {
  id?: string;
  code: string;
  name: string;
  description: string;
  priceToman: string;
  durationDays: string;
  features: EntitlementKey[];
  isVisible: boolean;
  sortOrder: string;
}

const empty: PlanFormData = { code: "", name: "", description: "", priceToman: "0", durationDays: "30", features: [], isVisible: false, sortOrder: "0" };

export function PlanDialog({ plan, trigger }: { plan?: PlanFormData; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState<PlanFormData>(plan ?? empty);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const err = (k: string) => (errors[k] ? <p role="alert" className="text-xs font-medium text-destructive">{errors[k]}</p> : null);
  const price = parseTomanToRial(v.priceToman || "0");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const { id, ...input } = v;
      const res = await savePlan(id ?? null, input);
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
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setV(plan ?? empty); setErrors({}); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{plan ? "ویرایش اشتراک" : "اشتراک جدید"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="pl-name">نام</Label>
              <Input id="pl-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="مثلاً اشتراک ماهانه" aria-invalid={!!errors.name} />
              {err("name")}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pl-code">کد (انگلیسی)</Label>
              <Input id="pl-code" dir="ltr" className="text-start" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} placeholder="monthly" aria-invalid={!!errors.code} />
              {err("code")}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pl-price">قیمت (تومان)</Label>
              <Input id="pl-price" dir="ltr" inputMode="numeric" className="text-start" value={v.priceToman} onChange={(e) => setV({ ...v, priceToman: e.target.value })} aria-invalid={!!errors.priceToman} />
              <p className="text-xs text-muted-foreground">{price === null ? "عدد معتبر نیست" : price === BigInt(0) ? "رایگان" : `${formatNumber(price / BigInt(10))} تومان`}</p>
              {err("priceToman")}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pl-days">مدت (روز)</Label>
              <Input id="pl-days" dir="ltr" inputMode="numeric" className="text-start" value={v.durationDays} onChange={(e) => setV({ ...v, durationDays: e.target.value })} aria-invalid={!!errors.durationDays} />
              {err("durationDays")}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pl-desc">توضیح (اختیاری)</Label>
            <Textarea id="pl-desc" rows={3} maxLength={1000} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
            {err("description")}
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">امکانات این اشتراک</legend>
            {ENTITLEMENT_KEYS.map((k) => (
              <label key={k} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--brand-green-dark)]" checked={v.features.includes(k)} onChange={(e) => setV({ ...v, features: e.target.checked ? [...v.features, k] : v.features.filter((f) => f !== k) })} />
                {ENTITLEMENTS[k]}
              </label>
            ))}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--brand-green-dark)]" checked={v.isVisible} onChange={(e) => setV({ ...v, isVisible: e.target.checked })} />
              نمایش در صفحهٔ همکاران (با برچسب «به‌زودی»)
            </label>
            <div className="grid gap-1.5">
              <Label htmlFor="pl-sort">ترتیب نمایش</Label>
              <Input id="pl-sort" dir="ltr" inputMode="numeric" className="text-start" value={v.sortOrder} onChange={(e) => setV({ ...v, sortOrder: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>انصراف</Button>
            <Button type="submit" loading={pending}>ذخیره</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
