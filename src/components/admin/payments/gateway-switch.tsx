"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { setActivePaymentProvider } from "@/features/settings/actions";

/** Picks the gateway new payments go through. Only gateways whose keys are in the server's .env are listed. */
export function GatewaySwitch({ options, active }: { options: { key: string; label: string; testMode: boolean }[]; active: string | null }) {
  const router = useRouter();
  const [value, setValue] = React.useState(active ?? "disabled");
  const [pending, start] = React.useTransition();
  const changed = value !== (active ?? "disabled");
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base">درگاه پرداخت</CardTitle>
        <p className="text-sm leading-7 text-muted-foreground">همهٔ پرداخت‌های جدید (فروشگاه، رزرو، تورنومنت، اشتراک) از درگاه انتخاب‌شده انجام می‌شوند. با عوض کردن درگاه، پرداخت‌هایی که روی درگاه قبلی شروع شده‌اند همچنان تأیید می‌شوند.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <fieldset className="grid gap-2" disabled={pending}>
          <legend className="sr-only">درگاه فعال</legend>
          {options.map((o) => (
            <label key={o.key} className="flex items-center gap-3 rounded-xl border p-3 text-sm has-checked:border-brand-green-dark has-checked:bg-success-soft">
              <input type="radio" name="gateway" value={o.key} checked={value === o.key} onChange={() => setValue(o.key)} className="size-4 accent-[var(--brand-green-dark)]" />
              <span className="font-semibold">{o.label}</span>
              {o.testMode ? <span className="ms-auto rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning">آزمایشی</span> : null}
            </label>
          ))}
          <label className="flex items-center gap-3 rounded-xl border p-3 text-sm has-checked:border-destructive">
            <input type="radio" name="gateway" value="disabled" checked={value === "disabled"} onChange={() => setValue("disabled")} className="size-4" />
            <span className="font-semibold">خاموش (بدون پرداخت آنلاین)</span>
          </label>
        </fieldset>
        {options.length < 2 ? <p className="text-xs leading-6 text-muted-foreground">برای اضافه شدن درگاه دیگر، کلیدهای آن درگاه باید در فایل تنظیمات سرور (.env) قرار بگیرد؛ بعد همین‌جا قابل انتخاب است.</p> : null}
        <Button
          disabled={!changed || pending}
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await setActivePaymentProvider(value);
              if (!res.ok) return void toast.error(res.error);
              toast.success(res.message);
              router.refresh();
            })
          }
        >
          ذخیرهٔ درگاه
        </Button>
      </CardContent>
    </Card>
  );
}
