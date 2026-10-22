"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loginWithCode, loginWithPassword, requestLoginCode } from "@/features/auth/actions";
import { loginPasswordSchema, requestCodeSchema } from "@/features/auth/schemas";
import { applyFieldErrors } from "./apply-errors";
import { CodeStep } from "./code-step";
import { PasswordInput } from "./password-input";
import { useCountdown } from "./use-countdown";

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? undefined;
  return (
    <Tabs defaultValue="password" className="grid gap-5">
      <TabsList>
        <TabsTrigger value="password">با رمز عبور</TabsTrigger>
        <TabsTrigger value="code">با کد یک‌بار مصرف</TabsTrigger>
      </TabsList>
      <TabsContent value="password">
        <PasswordLogin next={next} />
      </TabsContent>
      <TabsContent value="code">
        <CodeLogin next={next} />
      </TabsContent>
    </Tabs>
  );
}

function useFinishLogin() {
  const router = useRouter();
  return (redirectTo: string) => {
    toast.success("خوش آمدید!");
    router.replace(redirectTo);
    router.refresh();
  };
}

function PasswordLogin({ next }: { next?: string }) {
  const finish = useFinishLogin();
  const form = useForm<z.input<typeof loginPasswordSchema>>({
    resolver: zodResolver(loginPasswordSchema),
    defaultValues: { identifier: "", password: "", next },
  });

  async function onSubmit(values: z.input<typeof loginPasswordSchema>) {
    const res = await loginWithPassword({ ...values, next });
    if (res.ok) return finish(res.data.redirectTo);
    applyFieldErrors(form.setError, res.fieldErrors);
    toast.error(res.error);
  }

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="identifier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ایمیل یا شمارهٔ موبایل</FormLabel>
              <FormControl>
                <Input {...field} dir="ltr" className="text-start" autoComplete="username" placeholder="09121234567" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>رمز عبور</FormLabel>
                <Link href="/forgot-password" className="text-xs text-link hover:underline">
                  فراموشی رمز عبور
                </Link>
              </div>
              <FormControl>
                <PasswordInput {...field} autoComplete="current-password" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
          ورود
        </Button>
      </form>
    </Form>
  );
}

function CodeLogin({ next }: { next?: string }) {
  const finish = useFinishLogin();
  const countdown = useCountdown();
  const [sent, setSent] = React.useState<{ identifier: string; masked: string } | null>(null);
  const [code, setCode] = React.useState("");
  const [codeError, setCodeError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();

  const form = useForm<z.input<typeof requestCodeSchema>>({ resolver: zodResolver(requestCodeSchema), defaultValues: { identifier: "" } });

  function send(identifier: string) {
    startTransition(async () => {
      const res = await requestLoginCode({ identifier });
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

  function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!sent) return;
    setCodeError(undefined);
    startTransition(async () => {
      const res = await loginWithCode({ identifier: sent.identifier, code, next });
      if (res.ok) return finish(res.data.redirectTo);
      setCodeError(res.fieldErrors?.code ?? res.error);
    });
  }

  if (sent) {
    return (
      <form onSubmit={verify} className="grid gap-4">
        <CodeStep
          masked={sent.masked}
          code={code}
          onCodeChange={setCode}
          error={codeError}
          secondsLeft={countdown.seconds}
          onResend={() => send(sent.identifier)}
          onBack={() => {
            setSent(null);
            setCode("");
          }}
          resending={pending}
        />
        <Button type="submit" size="lg" loading={pending}>
          ورود
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
              <FormLabel>ایمیل یا شمارهٔ موبایل</FormLabel>
              <FormControl>
                <Input {...field} dir="ltr" className="text-start" autoComplete="username" placeholder="09121234567" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" loading={pending}>
          دریافت کد ورود
        </Button>
      </form>
    </Form>
  );
}
