"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, KeyRound, Lock, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeGamenetPassword, createGamenetAccount } from "@/features/gamenet-license/actions";
import { PASSWORD_HINTS, USERNAME_HINT } from "@/features/gamenet-license/rules";

export interface GamenetAccountView {
  username: string;
  status: "active" | "suspended" | "expired";
  endDate: string;
  deviceCount: number;
  maxDevices: number;
  remote: boolean;
}

function Field({ id, label, error, ...props }: { id: string; label: string; error?: string } & React.ComponentProps<"input">) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} dir="ltr" autoComplete="off" aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} className="text-left" {...props} />
      {error ? <p id={`${id}-err`} className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function PasswordRules() {
  return (
    <ul className="grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
      {PASSWORD_HINTS.map((h) => <li key={h}>• {h}</li>)}
    </ul>
  );
}

/** «نرم‌افزار مدیریت گیم‌نت» in the partner area: create the account with your own username/password, or see it and change the password. */
export function GamenetAppCard({
  entitled,
  account,
  unavailable,
  downloadUrl,
}: {
  entitled: boolean;
  account: GamenetAccountView | null;
  unavailable: boolean;
  downloadUrl: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [showChange, setShowChange] = React.useState(false);

  const submit = (e: React.FormEvent<HTMLFormElement>, action: "create" | "password") => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const values = Object.fromEntries(fd.entries());
    setErrors({});
    startTransition(async () => {
      const res = action === "create" ? await createGamenetAccount(values) : await changeGamenetPassword(values);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      toast.success(res.message);
      (e.target as HTMLFormElement).reset();
      setShowChange(false);
      router.refresh();
    });
  };

  if (unavailable) {
    return <Alert variant="warning">اطلاعات حساب نرم‌افزار الان در دسترس نیست؛ چند دقیقه بعد دوباره سر بزنید.</Alert>;
  }

  if (account) {
    const statusBadge =
      account.status === "active" ? <Badge variant="success">فعال</Badge> : account.status === "suspended" ? <Badge variant="destructive">مسدود</Badge> : <Badge variant="warning">منقضی</Badge>;
    return (
      <div className="space-y-4 text-sm">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div><dt className="text-muted-foreground">نام کاربری برنامه</dt><dd className="font-mono font-semibold" dir="ltr">{account.username}</dd></div>
          <div><dt className="text-muted-foreground">وضعیت</dt><dd>{statusBadge}</dd></div>
          <div><dt className="text-muted-foreground">اعتبار تا</dt><dd className="font-semibold">{account.endDate}</dd></div>
          <div><dt className="text-muted-foreground">کامپیوترهای فعال</dt><dd>{account.deviceCount.toLocaleString("fa-IR")} از {account.maxDevices.toLocaleString("fa-IR")}</dd></div>
          <div><dt className="text-muted-foreground">ریموت موبایل</dt><dd>{account.remote ? <Badge variant="success">دارد</Badge> : <Badge variant="outline">ندارد</Badge>}</dd></div>
        </dl>
        <p className="leading-7 text-muted-foreground">برنامه را روی کامپیوتر گیم‌نت نصب کنید و با همین نام کاربری و رمزی که انتخاب کرده‌اید فعالش کنید. با تمدید اشتراک در سایت، اعتبار برنامه هم خودکار تمدید می‌شود.</p>
        <div className="flex flex-wrap gap-2">
          {downloadUrl ? (
            <Button asChild variant="outline"><a href={downloadUrl} target="_blank" rel="noopener"><Download /> دانلود برنامه</a></Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => setShowChange((v) => !v)}><KeyRound /> تغییر رمز برنامه</Button>
        </div>
        {showChange ? (
          <form onSubmit={(e) => submit(e, "password")} className="space-y-3 rounded-xl border p-4" noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="gn-new-pw" name="password" type="password" label="رمز جدید" error={errors.password} required />
              <Field id="gn-new-pw2" name="confirm" type="password" label="تکرار رمز جدید" error={errors.confirm} required />
            </div>
            <PasswordRules />
            <Button type="submit" loading={pending}>ذخیرهٔ رمز جدید</Button>
          </form>
        ) : null}
      </div>
    );
  }

  if (!entitled) {
    return (
      <div className="space-y-2 text-sm">
        <Badge variant="outline"><Lock className="size-3" /> نیازمند اشتراک شامل نرم‌افزار</Badge>
        <p className="leading-7 text-muted-foreground">برنامهٔ مدیریت گیم‌نت (تایمر سیستم‌ها، بوفه، نسیه، گزارش و ریموت موبایل) با اشتراک‌هایی که این امکان را دارند فعال می‌شود. بعد از خرید، همین‌جا نام کاربری و رمز برنامه را انتخاب می‌کنید.</p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => submit(e, "create")} className="space-y-4 text-sm" noValidate>
      <p className="leading-7 text-muted-foreground">نام کاربری و رمزی برای ورود به برنامه انتخاب کنید. با همین‌ها برنامه را روی کامپیوتر گیم‌نت فعال می‌کنید.</p>
      <Field id="gn-user" name="username" label="نام کاربری برنامه" placeholder="atomclub" error={errors.username} required />
      <p className="-mt-2 text-xs text-muted-foreground">{USERNAME_HINT}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="gn-pw" name="password" type="password" label="رمز عبور" error={errors.password} required />
        <Field id="gn-pw2" name="confirm" type="password" label="تکرار رمز عبور" error={errors.confirm} required />
      </div>
      <PasswordRules />
      <Button type="submit" loading={pending}><MonitorSmartphone /> ساخت حساب برنامه</Button>
    </form>
  );
}
