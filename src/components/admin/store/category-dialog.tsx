"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { applyFieldErrors } from "@/components/auth/apply-errors";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { saveCategory } from "@/features/store/admin-actions";
import { categorySchema } from "@/features/store/schemas";
import { slugify } from "@/lib/text";

type Values = z.input<typeof categorySchema>;
export interface CategoryFormData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
}

export function CategoryDialog({
  category,
  parents,
  trigger,
}: {
  category?: CategoryFormData;
  parents: { id: string; name: string }[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const slugTouched = React.useRef(!!category);
  const defaults: Values = {
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    description: category?.description ?? "",
    parentId: category?.parentId ?? "",
    sortOrder: category?.sortOrder ?? 0,
    isActive: category?.isActive ?? true,
  };
  const form = useForm<Values, unknown, z.output<typeof categorySchema>>({ resolver: zodResolver(categorySchema), defaultValues: defaults });

  async function onSubmit() {
    // Send raw input: the server validates and transforms it again.
    const res = await saveCategory(category?.id ?? null, form.getValues());
    if (!res.ok) {
      applyFieldErrors(form.setError, res.fieldErrors);
      return toast.error(res.error);
    }
    toast.success(res.message);
    setOpen(false);
    if (!category) form.reset(defaults);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) form.reset(defaults); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? "ویرایش دسته" : "دستهٔ جدید"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نام دسته</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        if (!slugTouched.current) form.setValue("slug", slugify(e.target.value));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نامک (آدرس)</FormLabel>
                  <FormControl>
                    <Input {...field} onChange={(e) => { slugTouched.current = true; field.onChange(e); }} />
                  </FormControl>
                  <FormDescription>در آدرس صفحه استفاده می‌شود؛ مثلاً «دسته-بازی».</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>دستهٔ والد</FormLabel>
                    <FormControl>
                      <NativeSelect {...field} value={field.value ?? ""}>
                        <option value="">— بدون والد —</option>
                        {parents.filter((p) => p.id !== category?.id).map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </NativeSelect>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ترتیب نمایش</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} dir="ltr" className="text-start" {...field} value={String(field.value ?? 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>توضیحات (اختیاری)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} className="size-4 accent-[var(--brand-green-dark)]" />
                  نمایش در فروشگاه
                </label>
              )}
            />
            <DialogFooter>
              <Button type="submit" loading={form.formState.isSubmitting}>ذخیره</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
