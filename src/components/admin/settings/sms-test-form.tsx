"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { sendTestSms } from "@/features/sms/test-actions";

export function SmsTestForm() {
  const [mobile, setMobile] = React.useState("");
  const [kind, setKind] = React.useState("otp");
  const [result, setResult] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = React.useTransition();

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await sendTestSms(mobile, kind);
          setResult(res.ok ? { ok: true, text: res.message ?? "ارسال شد." } : { ok: false, text: res.error });
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="sms-mobile">شمارهٔ موبایل گیرنده</Label>
          <Input id="sms-mobile" dir="ltr" className="text-start" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="09121234567" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sms-kind">نوع پیامک</Label>
          <NativeSelect id="sms-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="otp">کد تأیید (ورود و ثبت‌نام) — با کد ۱۲۳۴۵</option>
            <option value="staff">پشتیبانی: پیام جدید برای مدیر</option>
            <option value="reply">پشتیبانی: پاسخ برای مشتری</option>
          </NativeSelect>
        </div>
      </div>
      <div>
        <Button type="submit" loading={pending} disabled={!mobile.trim()}>
          <Send /> ارسال پیامک آزمایشی
        </Button>
      </div>
      {result ? (
        <Alert variant={result.ok ? "success" : "destructive"}>
          <span className="break-words">{result.text}</span>
        </Alert>
      ) : null}
    </form>
  );
}
