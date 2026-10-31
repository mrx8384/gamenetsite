import type { Metadata } from "next";
import { Suspense } from "react";
import { MailTestForm } from "@/components/admin/settings/mail-test-form";
import { SmsTestForm } from "@/components/admin/settings/sms-test-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingRows } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/dal";
import { smsCodesAvailable } from "@/features/auth/verification";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "پیامک و ایمیل" };

export default function SmsSettingsPage() {
  return (
    <Suspense fallback={<LoadingRows rows={4} />}>
      <Content />
    </Suspense>
  );
}

function Row({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={good ? "success" : "warning"} className="ltr">{value}</Badge>
    </div>
  );
}

async function Content() {
  await requireRole(["ADMIN"], "/admin/settings/sms");
  // Only non-secret facts are shown; the API key itself never leaves the server.
  const live = env.SMS_PROVIDER === "smsir";
  const mailLive = env.MAIL_PROVIDER === "smtp";
  const smtpHost = env.SMTP_HOST ? `${env.SMTP_HOST}:${env.SMTP_PORT}` : env.SMTP_URL ? new URL(env.SMTP_URL).host : null;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">وضعیت تنظیمات پیامک (از فایل ‎.env‎ سرور)</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <Row label="ارسال واقعی پیامک (SMS_PROVIDER)" value={live ? "smsir — فعال" : "log — غیرفعال"} good={live} />
          <Row label="کلید API" value={env.SMS_API_KEY ? "تنظیم شده" : "تنظیم نشده"} good={!!env.SMS_API_KEY} />
          <Row label="قالب کد تأیید (SMS_TEMPLATE_ID)" value={env.SMS_TEMPLATE_ID ? `${env.SMS_TEMPLATE_ID} · متغیر #${env.SMS_TEMPLATE_PARAM}#` : "تنظیم نشده"} good={!!env.SMS_TEMPLATE_ID} />
          <Row label="قالب پشتیبانی برای مدیر" value={env.SMS_SUPPORT_STAFF_TEMPLATE_ID ? String(env.SMS_SUPPORT_STAFF_TEMPLATE_ID) : "تنظیم نشده (اختیاری)"} good={!!env.SMS_SUPPORT_STAFF_TEMPLATE_ID} />
          <Row label="قالب پشتیبانی برای مشتری" value={env.SMS_SUPPORT_REPLY_TEMPLATE_ID ? String(env.SMS_SUPPORT_REPLY_TEMPLATE_ID) : "تنظیم نشده (اختیاری)"} good={!!env.SMS_SUPPORT_REPLY_TEMPLATE_ID} />
          <p className="pt-3 text-xs leading-6 text-muted-foreground">این مقادیر فقط از فایل ‎.env‎ روی سرور تغییر می‌کنند و بعد از تغییر باید سایت ری‌استارت شود (systemctl restart atom).</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">ارسال پیامک آزمایشی</CardTitle></CardHeader>
        <CardContent><SmsTestForm /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">وضعیت ایمیل (از فایل ‎.env‎ سرور)</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <Row label="ارسال واقعی ایمیل (MAIL_PROVIDER)" value={mailLive ? "smtp — فعال" : "log — غیرفعال"} good={mailLive} />
          <Row label="سرور SMTP" value={smtpHost ?? "تنظیم نشده"} good={!!smtpHost} />
          <Row label="رمز صندوق ایمیل" value={env.SMTP_PASSWORD || env.SMTP_URL ? "تنظیم شده" : "تنظیم نشده"} good={!!(env.SMTP_PASSWORD || env.SMTP_URL)} />
          <Row label="کد تأیید برای شمارهٔ موبایل" value={smsCodesAvailable() ? "فعال" : "غیرفعال — فقط با ایمیل"} good={smsCodesAvailable()} />
          <p className="pt-3 text-xs leading-6 text-muted-foreground">تا وقتی پیامک فعال نیست، ثبت‌نام، ورود با کد و بازیابی رمز فقط با ایمیل انجام می‌شود و به کسی که شمارهٔ موبایل وارد کند همین را می‌گوییم. ورود با رمز عبور برای همه کار می‌کند.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">ارسال ایمیل آزمایشی</CardTitle></CardHeader>
        <CardContent><MailTestForm /></CardContent>
      </Card>
    </div>
  );
}
