import { formatToman } from "@/lib/format";

export function OrderSummary({ subtotal, shipping, total, children }: { subtotal: string; shipping: string; total: string; children?: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border bg-surface p-5 shadow-card">
      <p className="font-bold">خلاصهٔ سفارش</p>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">جمع کالاها</dt><dd>{formatToman(BigInt(subtotal))}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">هزینهٔ ارسال</dt><dd>{BigInt(shipping) === BigInt(0) ? "رایگان" : formatToman(BigInt(shipping))}</dd></div>
        <div className="flex justify-between border-t pt-2 text-base font-black"><dt>مبلغ قابل پرداخت</dt><dd>{formatToman(BigInt(total))}</dd></div>
      </dl>
      {children}
    </div>
  );
}
