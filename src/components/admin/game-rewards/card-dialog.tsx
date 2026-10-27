"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { saveRewardCard } from "@/features/game-rewards/admin-actions";

export interface RewardCardFormData {
  id?: string;
  title: string;
  description: string;
  pointsCost: string;
  discountPercent: string;
  channel: "IN_STORE" | "ONLINE" | "BOTH";
  validDays: string;
  limitPer30Days: string;
  isActive: boolean;
  sortOrder: string;
}

const empty: RewardCardFormData = { title: "کارت تخفیف ۱۰٪", description: "", pointsCost: "1000", discountPercent: "10", channel: "IN_STORE", validDays: "30", limitPer30Days: "1", isActive: true, sortOrder: "0" };

export function RewardCardDialog({ card, trigger }: { card?: RewardCardFormData; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState<RewardCardFormData>(card ?? empty);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const err = (k: string) => (errors[k] ? <p role="alert" className="text-xs font-medium text-destructive">{errors[k]}</p> : null);
  const set = (k: keyof RewardCardFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveRewardCard(card?.id ?? null, v);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      toast.success(res.message);
      setOpen(false);
      if (!card) setV(empty);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setV(card ?? empty);
          setErrors({});
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{card ? "ویرایش کارت تخفیف" : "کارت تخفیف جدید"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="c-title">عنوان</Label>
            <Input id="c-title" value={v.title} onChange={set("title")} maxLength={80} aria-invalid={!!errors.title} />
            {err("title")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-desc">توضیح (اختیاری)</Label>
            <Textarea id="c-desc" value={v.description} onChange={set("description")} maxLength={300} rows={2} placeholder="مثلاً روی ساعت بازی PS5" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="c-cost">امتیاز لازم</Label>
              <Input id="c-cost" inputMode="numeric" dir="ltr" value={v.pointsCost} onChange={set("pointsCost")} aria-invalid={!!errors.pointsCost} />
              {err("pointsCost")}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-pct">درصد تخفیف</Label>
              <Input id="c-pct" inputMode="numeric" dir="ltr" value={v.discountPercent} onChange={set("discountPercent")} aria-invalid={!!errors.discountPercent} />
              {err("discountPercent")}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-channel">محل استفاده</Label>
            <NativeSelect id="c-channel" value={v.channel} onChange={set("channel")}>
              <option value="IN_STORE">حضوری در گیم‌نت (کد را پیشخوان ثبت می‌کند)</option>
              <option value="ONLINE">فروشگاه آنلاین (هنگام پرداخت سفارش)</option>
              <option value="BOTH">هر دو</option>
            </NativeSelect>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="c-days">اعتبار (روز)</Label>
              <Input id="c-days" inputMode="numeric" dir="ltr" value={v.validDays} onChange={set("validDays")} aria-invalid={!!errors.validDays} />
              {err("validDays")}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-limit">سقف برای هر نفر در ۳۰ روز</Label>
              <Input id="c-limit" inputMode="numeric" dir="ltr" value={v.limitPer30Days} onChange={set("limitPer30Days")} aria-invalid={!!errors.limitPer30Days} />
              <p className="text-xs text-muted-foreground">۰ یعنی بدون سقف</p>
              {err("limitPer30Days")}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-order">ترتیب</Label>
              <Input id="c-order" inputMode="numeric" dir="ltr" value={v.sortOrder} onChange={set("sortOrder")} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} className="size-4 accent-[var(--brand-green-dark)]" />
            فعال (در دنیای سه‌بعدی نمایش داده شود)
          </label>
          <DialogFooter>
            <Button type="submit" loading={pending}>
              ذخیره
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
