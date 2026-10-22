"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { completeRegistration, startRegistration } from "@/features/auth/actions";
import { registerStartSchema } from "@/features/auth/schemas";
import { applyFieldErrors } from "./apply-errors";
import { CodeStep } from "./code-step";
import { PasswordInput } from "./password-input";
import { useCountdown } from "./use-countdown";

type Values = z.input<typeof registerStartSchema>;

export function RegisterForm() {
  const router = useRouter();
  const countdown = useCountdown();
  const [masked, setMasked] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [codeError, setCodeError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  const form = useForm<Values>({ resolver: zodResolver(registerStartSchema), defaultValues: { name: "", identifier: "", password: "" } });

  function send(values: Values) {
    startTransition(async () => {
      const res = await startRegistration(values);
      if (!res.ok) {
        applyFieldErrors(form.setError, res.fieldErrors);
        toast.error(res.error);
        return;
      }
      setMasked(res.data.masked);
      countdown.start(res.data.cooldownSeconds);
    });
  }

  function confirm(e: React.FormEvent) {
    e.preventDefault();
    setCodeError(undefined);
    startTransition(async () => {
      const res = await completeRegistration({ ...form.getValues(), code });
      if (res.ok) {
        toast.success(res.message ?? "ثبت‌نام انجام شد.");
        router.replace(res.data.redirectTo);
        router.refresh();
        return;
      }
      if (res.fieldErrors && !res.fieldErrors.code) {
        // Form data became invalid (e.g. account created meanwhile): go back to the form.
        setMasked(null);
        applyFieldErrors(form.setError, res.fieldErrors);
      }
      setCodeError(res.fieldErrors?.code ?? res.error);
    });
  }

  if (masked) {
    return (
      <form onSubmit={confirm} className="grid gap-4">
        <CodeStep
          masked={masked}
          code={code}
          onCodeChange={setCode}
          error={codeError}
          secondsLeft={countdown.seconds}
          onResend={() => send(form.getValues())}
          onBack={() => {
            setMasked(null);
            setCode("");
          }}
          resending={pending}
        />
        <Button type="submit" size="lg" loading={pending}>
          تأیید و ساخت حساب
        </Button>
      </form>
    );
  }

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(send)} className="grid gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>نام و نام خانوادگی</FormLabel>
              <FormControl>
                <Input {...field} autoComplete="name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="identifier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>شمارهٔ موبایل یا ایمیل</FormLabel>
              <FormControl>
                <Input {...field} dir="ltr" className="text-start" autoComplete="username" placeholder="09121234567" />
              </FormControl>
              <FormDescription>برای تأیید، یک کد به آن ارسال می‌شود.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>رمز عبور</FormLabel>
              <FormControl>
                <PasswordInput {...field} autoComplete="new-password" />
              </FormControl>
              <FormDescription>حداقل ۸ کاراکتر، شامل حرف و عدد.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" loading={pending}>
          دریافت کد تأیید
        </Button>
      </form>
    </Form>
  );
}
