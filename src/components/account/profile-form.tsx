"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { updateProfile } from "@/features/account/actions";
import { profileSchema } from "@/features/auth/schemas";
import { applyFieldErrors } from "@/components/auth/apply-errors";

export function ProfileForm({ name }: { name: string }) {
  const router = useRouter();
  const form = useForm<z.input<typeof profileSchema>>({ resolver: zodResolver(profileSchema), defaultValues: { name } });

  async function onSubmit(values: z.input<typeof profileSchema>) {
    const res = await updateProfile(values);
    if (!res.ok) {
      applyFieldErrors(form.setError, res.fieldErrors);
      return toast.error(res.error);
    }
    toast.success(res.message);
    form.reset(values);
    router.refresh();
  }

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid max-w-md gap-4">
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
        <Button type="submit" className="justify-self-start" loading={form.formState.isSubmitting} disabled={!form.formState.isDirty}>
          ذخیرهٔ تغییرات
        </Button>
      </form>
    </Form>
  );
}
