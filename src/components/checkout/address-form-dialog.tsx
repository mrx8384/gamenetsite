"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { saveAddress } from "@/features/orders/actions";
import { IRAN_PROVINCES } from "@/lib/provinces";

const empty = { recipientName: "", phone: "", province: "", city: "", postalCode: "", line: "" };
type Values = typeof empty;

export function AddressFormDialog({ defaults, onSaved }: { defaults?: Partial<Values>; onSaved?: (id: string) => void }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<Values>({ ...empty, ...defaults });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const err = (k: string) => (errors[k] ? <p role="alert" className="text-xs font-medium text-destructive">{errors[k]}</p> : null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveAddress(null, values);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      toast.success(res.message);
      setOpen(false);
      setValues({ ...empty, ...defaults });
      setErrors({});
      onSaved?.(res.data.id);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Plus /> آدرس جدید</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>آدرس جدید</DialogTitle></DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5"><Label htmlFor="a-name">نام گیرنده</Label><Input id="a-name" value={values.recipientName} onChange={set("recipientName")} aria-invalid={!!errors.recipientName} />{err("recipientName")}</div>
          <div className="grid gap-1.5"><Label htmlFor="a-phone">موبایل گیرنده</Label><Input id="a-phone" dir="ltr" className="text-start" inputMode="tel" value={values.phone} onChange={set("phone")} aria-invalid={!!errors.phone} />{err("phone")}</div>
          <div className="grid gap-1.5">
            <Label htmlFor="a-province">استان</Label>
            <NativeSelect id="a-province" value={values.province} onChange={set("province")} aria-invalid={!!errors.province}>
              <option value="">انتخاب کنید</option>
              {IRAN_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </NativeSelect>
            {err("province")}
          </div>
          <div className="grid gap-1.5"><Label htmlFor="a-city">شهر</Label><Input id="a-city" value={values.city} onChange={set("city")} aria-invalid={!!errors.city} />{err("city")}</div>
          <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="a-line">نشانی کامل</Label><Textarea id="a-line" rows={3} value={values.line} onChange={set("line")} aria-invalid={!!errors.line} />{err("line")}</div>
          <div className="grid gap-1.5"><Label htmlFor="a-postal">کد پستی (۱۰ رقم)</Label><Input id="a-postal" dir="ltr" className="text-start" inputMode="numeric" value={values.postalCode} onChange={set("postalCode")} aria-invalid={!!errors.postalCode} />{err("postalCode")}</div>
          <DialogFooter className="sm:col-span-2"><Button type="submit" loading={pending}>ذخیرهٔ آدرس</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
