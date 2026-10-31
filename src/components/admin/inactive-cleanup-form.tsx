"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { previewInactiveCleanup, saveAccountsSettings } from "@/features/users/actions";

const LABELS: Record<number, string> = { 0: "خاموش", 6: "۶ ماه", 12: "۱ سال", 24: "۲ سال", 36: "۳ سال" };

/** «حذف خودکار حساب‌های بدون فعالیت» with a live count of what the period would remove. */
export function InactiveCleanupForm({ initial }: { initial: number }) {
  const router = useRouter();
  const [months, setMonths] = React.useState(initial);
  const [count, setCount] = React.useState<number | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    let alive = true;
    void previewInactiveCleanup(months).then((r) => alive && setCount(r.ok ? r.data.count : null));
    return () => {
      alive = false;
    };
  }, [months]);

  return (
    <details className="group rounded-xl border bg-surface" open={initial > 0}>
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-bold">
        <Clock className="size-4 text-brand-green-deep" aria-hidden />
        حذف خودکار حساب‌های بدون فعالیت
        <span className="ms-auto text-xs font-medium text-muted-foreground">{LABELS[initial]}</span>
      </summary>
      <form
        className="space-y-3 border-t p-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await saveAccountsSettings({ inactiveDeleteMonths: months });
            if (!res.ok) return void toast.error(res.error);
            toast.success(res.message);
            router.refresh();
          });
        }}
      >
        <p className="text-xs leading-6 text-muted-foreground">
          هر شب حساب کاربرانی که در این مدت وارد سایت نشده‌اند حذف می‌شود. فقط کاربران عادی: حساب مدیر، پشتیبان و همکار، و هر کسی که سفارش ثبت کرده، هرگز خودکار حذف نمی‌شود. هر شب حداکثر ۵۰۰ حساب.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="inactive-months" className="text-sm">حذف بعد از</label>
          <NativeSelect id="inactive-months" value={String(months)} onChange={(e) => setMonths(Number(e.target.value))} className="w-36">
            {Object.entries(LABELS).map(([v, l]) => (
              <option key={v} value={v}>{v === "0" ? "خاموش (حذف نشود)" : `${l} بی‌فعالیتی`}</option>
            ))}
          </NativeSelect>
          <Button type="submit" size="sm" loading={pending} disabled={months === initial}>ذخیره</Button>
        </div>
        {months > 0 && count !== null ? (
          <p role="status" className={count > 0 ? "text-sm font-medium text-warning" : "text-sm text-muted-foreground"}>
            {count > 0 ? `با این تنظیم، امشب ${count.toLocaleString("fa-IR")} حساب حذف می‌شود.` : "با این تنظیم فعلاً حسابی حذف نمی‌شود."}
          </p>
        ) : null}
      </form>
    </details>
  );
}
