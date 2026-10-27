"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptRewardCode, adjustUserPoints, cancelRewardCode } from "@/features/game-rewards/admin-actions";

/** Buttons for one card found by its code. */
export function RewardCodeActions({ code, canUseInStore }: { code: string; canUseInStore: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [confirm, setConfirm] = React.useState<"use" | "cancel" | "refund" | null>(null);
  const run = (what: "use" | "cancel" | "refund") =>
    startTransition(async () => {
      const res = what === "use" ? await acceptRewardCode(code) : await cancelRewardCode(code, what === "refund");
      setConfirm(null);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      router.refresh();
    });
  if (confirm)
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{confirm === "use" ? "استفادهٔ این کارت ثبت شود؟" : confirm === "refund" ? "کارت لغو و امتیاز برگردانده شود؟" : "کارت بدون برگشت امتیاز لغو شود؟"}</span>
        <Button size="sm" loading={pending} onClick={() => run(confirm)}>
          بله
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirm(null)}>
          انصراف
        </Button>
      </div>
    );
  return (
    <div className="flex flex-wrap gap-2">
      {canUseInStore ? <Button onClick={() => setConfirm("use")}>✓ ثبت استفاده در گیم‌نت</Button> : null}
      <Button variant="outline" onClick={() => setConfirm("refund")}>
        لغو و برگشت امتیاز
      </Button>
      <Button variant="ghost" onClick={() => setConfirm("cancel")}>
        لغو بدون برگشت امتیاز
      </Button>
    </div>
  );
}

/** Manual correction of a user's points. */
export function AdjustPointsForm() {
  const router = useRouter();
  const [v, setV] = React.useState({ identifier: "", amount: "", note: "" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const err = (k: string) => (errors[k] ? <p role="alert" className="text-xs font-medium text-destructive">{errors[k]}</p> : null);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await adjustUserPoints(v);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      setErrors({});
      toast.success(`${res.message} امتیاز فعلی: ${res.data.balance.toLocaleString("fa-IR")}`);
      setV({ identifier: "", amount: "", note: "" });
      router.refresh();
    });
  }
  return (
    <form onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-[2fr_1fr_2fr_auto] sm:items-end">
      <div className="grid gap-1.5">
        <Label htmlFor="adj-id">موبایل یا ایمیل کاربر</Label>
        <Input id="adj-id" dir="ltr" value={v.identifier} onChange={(e) => setV({ ...v, identifier: e.target.value })} aria-invalid={!!errors.identifier} />
        {err("identifier")}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="adj-amount">امتیاز (+ یا −)</Label>
        <Input id="adj-amount" dir="ltr" inputMode="numeric" placeholder="+200" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} aria-invalid={!!errors.amount} />
        {err("amount")}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="adj-note">دلیل</Label>
        <Input id="adj-note" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} maxLength={200} placeholder="مثلاً جایزهٔ تورنومنت" aria-invalid={!!errors.note} />
        {err("note")}
      </div>
      <Button type="submit" loading={pending}>
        ثبت
      </Button>
    </form>
  );
}
