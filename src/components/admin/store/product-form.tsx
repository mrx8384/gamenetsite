"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createProduct, updateProduct } from "@/features/store/admin-actions";
import { formatNumber } from "@/lib/format";
import { parseTomanToRial, slugify } from "@/lib/text";
import { ImageManager, type ManagedImage } from "./image-manager";

export interface ProductFormValues {
  title: string;
  slug: string;
  sku: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  price: string; // Toman, as typed
  compareAtPrice: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  isFeatured: boolean;
  initialStock: string;
  images: ManagedImage[];
}

function TomanHint({ value }: { value: string }) {
  const rial = value ? parseTomanToRial(value) : null;
  if (!value) return null;
  return <p className="text-xs text-muted-foreground">{rial === null ? "عدد معتبر نیست" : `${formatNumber(rial / BigInt(10))} تومان`}</p>;
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-xs font-medium text-destructive">
      {message}
    </p>
  ) : null;
}

export function ProductForm({ productId, initial, categories }: { productId?: string; initial: ProductFormValues; categories: { id: string; name: string; depth: number }[] }) {
  const router = useRouter();
  const [slugTouched, setSlugTouched] = React.useState(!!productId);
  const form = useForm<ProductFormValues>({ defaultValues: initial });
  const { register, control, formState, setError } = form;
  const [priceValue, compareValue] = useWatch({ control, name: ["price", "compareAtPrice"] });
  const errors = formState.errors;

  async function onSubmit(values: ProductFormValues) {
    const payload = {
      ...values,
      images: values.images.map((i) => ({ mediaId: i.mediaId, alt: i.alt })),
    };
    const res = productId ? await updateProduct(productId, payload) : await createProduct(payload);
    if (!res.ok) {
      for (const [field, message] of Object.entries(res.fieldErrors ?? {})) setError(field as keyof ProductFormValues, { message });
      return toast.error(res.error);
    }
    toast.success(res.message);
    if (!productId) router.push(`/admin/products/${res.data.id}`);
    else {
      form.reset(values);
      router.refresh();
    }
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>اطلاعات اصلی</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="title">عنوان محصول</Label>
              <Input
                id="title"
                aria-invalid={!!errors.title}
                {...register("title", {
                  onChange: (e) => {
                    if (!slugTouched) form.setValue("slug", slugify(e.target.value));
                  },
                })}
              />
              <FieldError message={errors.title?.message} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="slug">نامک (آدرس صفحه)</Label>
                <Input id="slug" aria-invalid={!!errors.slug} {...register("slug", { onChange: () => setSlugTouched(true) })} />
                <FieldError message={errors.slug?.message} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sku">کد کالا (SKU)</Label>
                <Input id="sku" dir="ltr" className="text-start uppercase" placeholder="ATM-001" aria-invalid={!!errors.sku} {...register("sku")} />
                <FieldError message={errors.sku?.message} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="shortDescription">توضیح کوتاه</Label>
              <Textarea id="shortDescription" rows={2} maxLength={500} aria-invalid={!!errors.shortDescription} {...register("shortDescription")} />
              <FieldError message={errors.shortDescription?.message} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="description">توضیحات کامل</Label>
              <Textarea id="description" rows={8} aria-invalid={!!errors.description} {...register("description")} />
              <p className="text-xs text-muted-foreground">برای پاراگراف جدید یک خط خالی بگذارید.</p>
              <FieldError message={errors.description?.message} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>تصاویر</CardTitle>
          </CardHeader>
          <CardContent>
            <Controller control={control} name="images" render={({ field }) => <ImageManager value={field.value} onChange={field.onChange} />} />
            <FieldError message={errors.images?.message} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>انتشار</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="status">وضعیت</Label>
              <NativeSelect id="status" {...register("status")}>
                <option value="DRAFT">پیش‌نویس (مخفی)</option>
                <option value="ACTIVE">فعال (نمایش در فروشگاه)</option>
                <option value="ARCHIVED">بایگانی (مخفی)</option>
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="categoryId">دسته</Label>
              <NativeSelect id="categoryId" {...register("categoryId")}>
                <option value="">— بدون دسته —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.depth ? "— " : ""}
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--brand-green-dark)]" {...register("isFeatured")} />
              نمایش در «محصولات منتخب» صفحهٔ اصلی
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>قیمت (تومان)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="price">قیمت فروش</Label>
              <Input id="price" inputMode="numeric" dir="ltr" className="text-start" aria-invalid={!!errors.price} {...register("price")} />
              <TomanHint value={priceValue} />
              <FieldError message={errors.price?.message} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="compareAtPrice">قیمت قبل از تخفیف (اختیاری)</Label>
              <Input id="compareAtPrice" inputMode="numeric" dir="ltr" className="text-start" aria-invalid={!!errors.compareAtPrice} {...register("compareAtPrice")} />
              <TomanHint value={compareValue} />
              <FieldError message={errors.compareAtPrice?.message} />
            </div>
          </CardContent>
        </Card>

        {!productId ? (
          <Card>
            <CardHeader>
              <CardTitle>موجودی اولیه</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1.5">
              <Input inputMode="numeric" dir="ltr" className="text-start" aria-label="موجودی اولیه" aria-invalid={!!errors.initialStock} {...register("initialStock")} />
              <p className="text-xs text-muted-foreground">تغییرات بعدی موجودی از صفحهٔ ویرایش و با ثبت تاریخچه انجام می‌شود.</p>
              <FieldError message={errors.initialStock?.message} />
            </CardContent>
          </Card>
        ) : null}

        <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
          {productId ? "ذخیرهٔ تغییرات" : "ایجاد محصول"}
        </Button>
      </div>
    </form>
  );
}
