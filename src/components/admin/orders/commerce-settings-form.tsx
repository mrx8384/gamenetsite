"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCommerceSettings } from "@/features/settings/actions";
import { formatNumber } from "@/lib/format";
import { parseTomanToRial } from "@/lib/text";
import { cn } from "@/lib/utils";

export function CommerceSettingsForm({
  initial,
  gatewayLabel,
}: {
  initial: { salesEnabled: boolean; shippingCostToman: string; priceInquiryPhone: string };
  gatewayLabel: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const shippingRial = parseTomanToRial(values.shippingCostToman || "0");

  function save(next = values) {
    startTransition(async () => {
      const res = await saveCommerceSettings(next);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      setErrors({});
      setValues(next);
      toast.success(res.message);
      router.refresh();
    });
  }

  return (
    <div className="grid max-w-2xl gap-6">
      <Card>
        <CardHeader><CardTitle>فروش آنلاین</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
            <div>
              <p className="font-semibold">وضعیت فروش: {values.salesEnabled ? <span className="text-success">باز</span> : <span className="text-destructive">بسته</span>}</p>
              <p className="text-sm text-muted-foreground">درگاه پرداخت: {gatewayLabel ?? "متصل نیست"}</p>
            </div>
            <Button
              variant={values.salesEnabled ? "destructive" : "default"}
              disabled={pending || (!values.salesEnabled && !gatewayLabel)}
              onClick={() => save({ ...values, salesEnabled: !values.salesEnabled })}
            >
              {values.salesEnabled ? "بستن فروش" : "باز کردن فروش"}
            </Button>
          </div>
          {!gatewayLabel ? <Alert variant="info">برای باز کردن فروش، ابتدا اطلاعات درگاه پرداخت باید روی سرور تنظیم شود.</Alert> : null}
          {errors.salesEnabled ? <p role="alert" className="text-xs text-destructive">{errors.salesEnabled}</p> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>هزینهٔ ارسال و تماس</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="shipping">هزینهٔ ارسال هر سفارش (تومان)</Label>
            <Input id="shipping" inputMode="numeric" dir="ltr" className={cn("text-start", errors.shippingCostToman && "border-destructive")} value={values.shippingCostToman} onChange={(e) => setValues({ ...values, shippingCostToman: e.target.value })} />
            <p className="text-xs text-muted-foreground">{shippingRial === null ? "عدد معتبر نیست" : shippingRial === BigInt(0) ? "ارسال رایگان" : `${formatNumber(shippingRial / BigInt(10))} تومان — همراه مبلغ سفارش از طریق درگاه پرداخت می‌شود`}</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="phone">شمارهٔ تماس برای «استعلام قیمت»</Label>
            <Input id="phone" inputMode="tel" dir="ltr" className="text-start" value={values.priceInquiryPhone} onChange={(e) => setValues({ ...values, priceInquiryPhone: e.target.value })} placeholder="02112345678" />
            {errors.priceInquiryPhone ? <p role="alert" className="text-xs text-destructive">{errors.priceInquiryPhone}</p> : null}
          </div>
          <Button className="justify-self-start" loading={pending} onClick={() => save()}>ذخیره</Button>
        </CardContent>
      </Card>
    </div>
  );
}
