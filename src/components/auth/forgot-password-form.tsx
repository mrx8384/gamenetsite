"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, resetPassword } from "@/features/auth/actions";
import { requestCodeSchema } from "@/features/auth/schemas";
import { passwordSchema } from "@/lib/auth/password-policy";
import { applyFieldErrors } from "./apply-errors";
import { CodeStep } from "./code-step";
import { PasswordInput } from "./password-input";
import { useCountdown } from "./use-countdown";

export function ForgotPasswordForm() {
  const router = useRouter();
  const countdown = useCountdown();
  const [sent, setSent] = React.useState<{ identifier: string; masked: string } | null>(null);
  const [code, setCode] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errors, setErrors] = React.useState<{ code?: string; password?: string }>({});
  const [pending, startTransition] = React.useTransition();
  const form = useForm<z.input<typeof requestCodeSchema>>({ resolver: zodResolver(requestCodeSchema), defaultValues: { identifier: "" } });

  function send(identifier: string) {
    startTransition(async () => {
      const res = await requestPasswordReset({ identifier });
      if (!res.ok) {
        applyFieldErrors(form.setError, res.fieldErrors);
        toast.error(res.error);
        return;
      }
      setSent({ identifier, masked: res.data.masked });
      countdown.start(res.data.cooldownSeconds);
      if (res.message) toast.info(res.message);
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sent) return;
    const pw = passwordSchema.safeParse(password);
    if (!pw.success) return setErrors({ password: pw.error.issues[0]?.message });
    setErrors({});
    startTransition(async () => {
      const res = await resetPassword({ identifier: sent.identifier, code, password });
      if (res.ok) {
        toast.success(res.message ?? "رمز عبور تغییر کرد.");
        router.replace(res.data.redirectTo);
        router.refresh();
        return;
      }
      setErrors({ code: res.fieldErrors?.code ?? (res.fieldErrors?.password ? undefined : res.error), password: res.fieldErrors?.password });
    });
  }

  if (sent) {
    return (
      <form onSubmit={submit} className="grid gap-4">
        <CodeStep
          masked={sent.masked}
          code={code}
          onCodeChange={setCode}
          error={errors.code}
          secondsLeft={countdown.seconds}
          onResend={() => send(sent.identifier)}
          onBack={() => setSent(null)}
          resending={pending}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="new-password">رمز عبور جدید</Label>
            <PasswordInput id="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" aria-invalid={!!errors.password} />
            {errors.password ? (
              <p role="alert" className="text-xs font-medium text-destructive">
                {errors.password}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">حداقل ۸ کاراکتر، شامل حرف و عدد.</p>
            )}
          </div>
        </CodeStep>
        <Button type="submit" size="lg" loading={pending}>
          تغییر رمز عبور
        </Button>
      </form>
    );
  }

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit((v) => send(v.identifier))} className="grid gap-4">
        <FormField
          control={form.control}
          name="identifier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ایمیل یا شمارهٔ موبایل حساب</FormLabel>
              <FormControl>
                <Input {...field} dir="ltr" className="text-start" autoComplete="username" placeholder="09121234567" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" loading={pending}>
          ارسال کد بازیابی
        </Button>
      </form>
    </Form>
  );
}
