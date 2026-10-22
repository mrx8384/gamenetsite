"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { savePartnerApplication } from "@/features/partners/actions";
import { BUSINESS_TYPE_LABELS, BUSINESS_TYPES } from "@/features/partners/constants";
import type { PartnerApplicationInput } from "@/features/partners/schemas";
import { IRAN_PROVINCES } from "@/lib/provinces";

type Values = Required<{ [K in keyof PartnerApplicationInput]: string }>;

const empty: Values = { businessName: "", businessType: "", province: "", city: "", address: "", phone: "", website: "", instagram: "", description: "" };

/**
 * New application, edit while pending, resubmit after rejection, or (approved) edit contact details.
 * `lockIdentity` keeps business name/type read-only for approved partners.
 */
export function PartnerForm({ initial, lockIdentity = false, submitLabel }: { initial?: Partial<Values>; lockIdentity?: boolean; submitLabel: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [v, setV] = React.useState<Values>({ ...empty, ...initial });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  const err = (k: string) => (errors[k] ? <p id={`${k}-error`} role="alert" className="text-xs font-medium text-destructive">{errors[k]}</p> : null);
  const aria = (k: string) => ({ "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `${k}-error` : undefined });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await savePartnerApplication(v);
          if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            return void toast.error(res.error);
          }
          setErrors({});
          toast.success(res.message);
          router.refresh();
        });
      }}
    >
      <fieldset disabled={!hydrated || pending} className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="p-name">نام کسب‌وکار</Label>
          <Input id="p-name" value={v.businessName} onChange={set("businessName")} readOnly={lockIdentity} maxLength={150} {...aria("businessName")} />
          {err("businessName")}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="p-type">نوع کسب‌وکار</Label>
          <NativeSelect id="p-type" value={v.businessType} onChange={set("businessType")} disabled={lockIdentity} {...aria("businessType")}>
            <option value="">انتخاب کنید</option>
            {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{BUSINESS_TYPE_LABELS[t]}</option>)}
          </NativeSelect>
          {err("businessType")}
        </div>
        {lockIdentity ? <p className="-mt-2 text-xs text-muted-foreground sm:col-span-2">برای تغییر نام یا نوع کسب‌وکار با آتم تماس بگیرید.</p> : null}
        <div className="grid gap-1.5">
          <Label htmlFor="p-province">استان</Label>
          <NativeSelect id="p-province" value={v.province} onChange={set("province")} {...aria("province")}>
            <option value="">انتخاب کنید</option>
            {IRAN_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
          </NativeSelect>
          {err("province")}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="p-city">شهر</Label>
          <Input id="p-city" value={v.city} onChange={set("city")} maxLength={50} {...aria("city")} />
          {err("city")}
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="p-address">نشانی</Label>
          <Input id="p-address" value={v.address} onChange={set("address")} maxLength={300} {...aria("address")} />
          {err("address")}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="p-phone">شمارهٔ تماس کسب‌وکار</Label>
          <Input id="p-phone" dir="ltr" className="text-start" inputMode="tel" placeholder="09121234567 یا 02112345678" value={v.phone} onChange={set("phone")} {...aria("phone")} />
          {err("phone")}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="p-instagram">اینستاگرام (اختیاری)</Label>
          <Input id="p-instagram" dir="ltr" className="text-start" placeholder="@atom.gameclub" value={v.instagram} onChange={set("instagram")} {...aria("instagram")} />
          {err("instagram")}
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="p-website">وب‌سایت (اختیاری)</Label>
          <Input id="p-website" dir="ltr" className="text-start" placeholder="https://" value={v.website} onChange={set("website")} {...aria("website")} />
          {err("website")}
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="p-desc">توضیحات (اختیاری)</Label>
          <Textarea id="p-desc" rows={4} maxLength={2000} placeholder="مثلاً تعداد دستگاه‌ها، سابقهٔ فعالیت، نوع همکاری موردنظر" value={v.description} onChange={set("description")} {...aria("description")} />
          {err("description")}
        </div>
        <Button type="submit" size="lg" loading={pending} className="sm:col-span-2 sm:justify-self-start">{submitLabel}</Button>
      </fieldset>
    </form>
  );
}
