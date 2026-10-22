"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MapPin, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteAddress, placeOrder } from "@/features/orders/actions";
import { formatNumber, formatToman, toPersianDigits } from "@/lib/format";
import { OrderSummary, type SummaryShipping } from "@/components/cart/order-summary";
import type { ShippingOption } from "@/features/shipping/queries";
import { cn } from "@/lib/utils";
import { AddressFormDialog } from "./address-form-dialog";

export interface CheckoutAddress {
  id: string;
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  line: string;
  isDefault: boolean;
}

export function CheckoutForm({
  addresses,
  userName,
  userPhone,
  payLabel,
  shippingMethods,
  subtotal,
  lines,
}: {
  addresses: CheckoutAddress[];
  userName: string;
  userPhone: string | null;
  payLabel: string;
  shippingMethods: ShippingOption[];
  subtotal: string;
  lines: { id: string; title: string; quantity: number }[];
}) {
  const router = useRouter();
  const [addressId, setAddressId] = React.useState(addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? "");
  const [note, setNote] = React.useState("");
  const [shippingId, setShippingId] = React.useState(shippingMethods[0]?.id ?? "");
  const method = shippingMethods.find((m) => m.id === shippingId);
  const summaryShipping: SummaryShipping = !method
    ? { kind: "pending" }
    : method.type === "COLLECT"
      ? { kind: "collect", carrier: method.name }
      : { kind: "prepaid", amount: method.price };
  const [pending, startTransition] = React.useTransition();
  const selected = addresses.some((a) => a.id === addressId) ? addressId : (addresses[0]?.id ?? "");

  function pay() {
    startTransition(async () => {
      const res = await placeOrder({ addressId: selected, shippingMethodId: shippingId, note });
      if (!res.ok) {
        toast.error(res.error);
        router.refresh();
        return;
      }
      window.location.assign(res.data.redirectTo); // gateway page (may be external)
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">آدرس تحویل</h2>
          <AddressFormDialog defaults={{ recipientName: userName, phone: userPhone ?? "" }} onSaved={setAddressId} />
        </div>
        {addresses.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">هنوز آدرسی ثبت نکرده‌اید. یک آدرس جدید اضافه کنید.</p>
        ) : (
          <div className="grid gap-3" role="radiogroup" aria-label="آدرس تحویل">
            {addresses.map((a) => (
              <label key={a.id} className={cn("flex cursor-pointer gap-3 rounded-xl border bg-surface p-4 transition-colors", selected === a.id && "border-brand-green ring-2 ring-brand-green/25")}>
                <input type="radio" name="address" value={a.id} checked={selected === a.id} onChange={() => setAddressId(a.id)} className="mt-1 size-4 accent-[var(--brand-green-dark)]" />
                <div className="min-w-0 flex-1 text-sm leading-7">
                  <p className="font-semibold"><MapPin className="me-1 inline size-4 text-muted-foreground" />{a.province}، {a.city}</p>
                  <p className="text-muted-foreground">{a.line}</p>
                  <p className="text-muted-foreground">{a.recipientName} · <span className="ltr">{toPersianDigits(a.phone)}</span> · کد پستی <span className="ltr">{toPersianDigits(a.postalCode)}</span></p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="حذف آدرس"
                  onClick={(e) => {
                    e.preventDefault();
                    startTransition(async () => {
                      const res = await deleteAddress(a.id);
                      if (!res.ok) toast.error(res.error);
                      router.refresh();
                    });
                  }}
                >
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </label>
            ))}
          </div>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="font-bold">روش ارسال</h2>
        {shippingMethods.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">در حال حاضر روش ارسالی فعال نیست. لطفاً بعداً تلاش کنید.</p>
        ) : (
          <div className="grid gap-3" role="radiogroup" aria-label="روش ارسال">
            {shippingMethods.map((m) => (
              <label key={m.id} className={cn("flex cursor-pointer gap-3 rounded-xl border bg-surface p-4 transition-colors", shippingId === m.id && "border-brand-green ring-2 ring-brand-green/25")}>
                <input type="radio" name="shipping" value={m.id} checked={shippingId === m.id} onChange={() => setShippingId(m.id)} className="mt-1 size-4 accent-[var(--brand-green-dark)]" />
                <div className="min-w-0 flex-1 text-sm leading-7">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    <Truck className="size-4 text-muted-foreground" aria-hidden />
                    {m.name}
                    <span className="text-xs font-normal text-muted-foreground">
                      {m.type === "COLLECT" ? "— پس‌کرایه (پرداخت هنگام تحویل)" : BigInt(m.price) === BigInt(0) ? "— رایگان" : `— ${formatToman(BigInt(m.price))}`}
                    </span>
                  </p>
                  {m.description ? <p className="text-muted-foreground">{m.description}</p> : null}
                </div>
              </label>
            ))}
          </div>
        )}
      </section>
      <section className="grid gap-1.5">
        <Label htmlFor="order-note">توضیحات سفارش (اختیاری)</Label>
        <Textarea id="order-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </section>
    </div>
      <div className="space-y-3 lg:sticky lg:top-24 lg:self-start">
        <OrderSummary subtotal={subtotal} shipping={summaryShipping}>
          <ul className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
            {lines.map((l) => (
              <li key={l.id} className="flex justify-between gap-2"><span className="truncate">{l.title}</span><span>× {formatNumber(l.quantity)}</span></li>
            ))}
          </ul>
          <Button size="lg" className="w-full" disabled={!selected || !method} loading={pending} onClick={pay}>
            {payLabel}
          </Button>
          <p className="text-center text-xs text-muted-foreground">با ثبت سفارش، کالاها ۲۰ دقیقه برای شما رزرو می‌شوند تا پرداخت را کامل کنید.</p>
        </OrderSummary>
      </div>
    </div>
  );
}
