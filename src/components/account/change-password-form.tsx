"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { applyFieldErrors } from "@/components/auth/apply-errors";
import { PasswordInput } from "@/components/auth/password-input";
import { changePassword } from "@/features/account/actions";
import { changePasswordSchema } from "@/features/auth/schemas";

type Values = z.input<typeof changePasswordSchema>;

export function ChangePasswordForm() {
  const router = useRouter();
  const form = useForm<Values>({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: "", newPassword: "" } });

  async function onSubmit(values: Values) {
    const res = await changePassword(values);
    if (!res.ok) {
      applyFieldErrors(form.setError, res.fieldErrors);
      return toast.error(res.error);
    }
    toast.success(res.message);
    form.reset();
    router.refresh();
  }

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid max-w-md gap-4">
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>رمز عبور فعلی</FormLabel>
              <FormControl>
                <PasswordInput {...field} autoComplete="current-password" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>رمز عبور جدید</FormLabel>
              <FormControl>
                <PasswordInput {...field} autoComplete="new-password" />
              </FormControl>
              <FormDescription>حداقل ۸ کاراکتر، شامل حرف و عدد. سایر دستگاه‌ها از حساب خارج می‌شوند.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="justify-self-start" loading={form.formState.isSubmitting}>
          تغییر رمز عبور
        </Button>
      </form>
    </Form>
  );
}
