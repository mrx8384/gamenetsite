import { formatToman } from "@/lib/format";

export type SummaryShipping = { kind: "pending" } | { kind: "collect"; carrier: string } | { kind: "prepaid"; amount: string };

/** Totals box. Shipping is either not chosen yet, paid to the carrier on delivery (پس‌کرایه), or a fixed amount paid online. */
export function OrderSummary({
  subtotal,
  shipping,
  discount,
  children,
}: {
  subtotal: string;
  shipping: SummaryShipping;
  /** Rial, from a 3D world discount card (checkout). */
  discount?: { amount: string; label: string };
  children?: React.ReactNode;
}) {
  const shippingAmount = shipping.kind === "prepaid" ? BigInt(shipping.amount) : BigInt(0);
  const off = discount ? BigInt(discount.amount) : BigInt(0);
  const total = BigInt(subtotal) - off + shippingAmount;
  return (
    <div className="space-y-3 rounded-xl border bg-surface p-5 shadow-card">
      <p className="font-bold">خلاصهٔ سفارش</p>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">جمع کالاها</dt><dd>{formatToman(BigInt(subtotal))}</dd></div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">هزینهٔ ارسال</dt>
          <dd className="text-end">
            {shipping.kind === "pending" ? "در مرحلهٔ ثبت سفارش" : shipping.kind === "collect" ? "پس‌کرایه" : shippingAmount === BigInt(0) ? "رایگان" : formatToman(shippingAmount)}
          </dd>
        </div>
        {discount && off > BigInt(0) ? (
          <div className="flex justify-between gap-3 text-success">
            <dt>{discount.label}</dt>
            <dd>− {formatToman(off)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between border-t pt-2 text-base font-black"><dt>مبلغ قابل پرداخت آنلاین</dt><dd>{formatToman(total)}</dd></div>
      </dl>
      {shipping.kind === "collect" ? (
        <p className="rounded-lg bg-info-soft p-3 text-xs leading-6">هزینهٔ ارسال را شرکت حمل «{shipping.carrier}» تعیین می‌کند و هنگام تحویل از شما دریافت می‌شود.</p>
      ) : null}
      {children}
    </div>
  );
}
