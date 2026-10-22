import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ORDER_STATUS_LABEL, type OrderStatusKey } from "@/features/orders/schemas";
import { formatDateTime, formatNumber, formatToman, toPersianDigits } from "@/lib/format";

export interface OrderDetailData {
  items: { id: string; titleSnapshot: string; skuSnapshot: string; unitPrice: bigint; quantity: number; lineTotal: bigint }[];
  subtotal: bigint;
  shippingCost: bigint;
  discount: bigint;
  total: bigint;
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  addressLine: string;
  customerNote: string | null;
  shippingMethodName: string | null;
  shippingType: "PREPAID" | "COLLECT" | null;
  trackingCode: string | null;
  trackingUrl: string | null;
  statusHistory: { id: string; from: OrderStatusKey | null; to: OrderStatusKey; note: string | null; createdAt: Date }[];
}

/** Items, totals, address and history — shared by the customer and admin order pages. */
export function OrderDetails({ order, stacked = false }: { order: OrderDetailData; stacked?: boolean }) {
  return (
    <div className={stacked ? "grid gap-6" : "grid gap-6 lg:grid-cols-[1fr_320px]"}>
      <div className="space-y-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>کالا</TableHead>
              <TableHead>قیمت واحد</TableHead>
              <TableHead>تعداد</TableHead>
              <TableHead>جمع</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((i) => (
              <TableRow key={i.id}>
                <TableCell>
                  <p className="font-medium">{i.titleSnapshot}</p>
                  <p className="ltr text-start text-xs text-muted-foreground">{i.skuSnapshot}</p>
                </TableCell>
                <TableCell className="whitespace-nowrap">{formatToman(i.unitPrice)}</TableCell>
                <TableCell>{formatNumber(i.quantity)}</TableCell>
                <TableCell className="whitespace-nowrap font-semibold">{formatToman(i.lineTotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Card>
          <CardHeader><CardTitle className="text-base">تاریخچهٔ وضعیت</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-3 border-s ps-4">
              {order.statusHistory.map((h) => (
                <li key={h.id} className="relative text-sm">
                  <span className="absolute -start-[21px] top-2 size-2.5 rounded-full bg-brand-green" aria-hidden />
                  <p className="font-semibold">{ORDER_STATUS_LABEL[h.to]}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(h.createdAt)}{h.note ? ` — ${h.note}` : ""}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
      <div className={stacked ? "grid gap-4 md:grid-cols-2" : "space-y-4"}>
        <Card>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">جمع کالاها</span><span>{formatToman(order.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">هزینهٔ ارسال</span><span>{order.shippingType === "COLLECT" ? "پس‌کرایه" : order.shippingCost === BigInt(0) ? "رایگان" : formatToman(order.shippingCost)}</span></div>
            {order.discount > BigInt(0) ? <div className="flex justify-between"><span className="text-muted-foreground">تخفیف</span><span>{formatToman(order.discount)}</span></div> : null}
            <div className="flex justify-between border-t pt-2 text-base font-black"><span>مبلغ کل</span><span>{formatToman(order.total)}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">ارسال به</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm leading-7">
            <p className="font-semibold">{order.recipientName} · <span className="ltr">{toPersianDigits(order.phone)}</span></p>
            <p className="text-muted-foreground">{order.province}، {order.city}، {order.addressLine}</p>
            <p className="text-muted-foreground">کد پستی: <span className="ltr">{toPersianDigits(order.postalCode)}</span></p>
            {order.shippingMethodName ? (
              <p className="border-t pt-2">
                روش ارسال: <span className="font-semibold">{order.shippingMethodName}</span>
                {order.shippingType === "COLLECT" ? <span className="block text-xs text-muted-foreground">پس‌کرایه — هزینهٔ ارسال هنگام تحویل به شرکت حمل پرداخت می‌شود.</span> : null}
              </p>
            ) : null}
            {order.trackingCode ? (
              <p>
                کد رهگیری: <span className="ltr font-semibold">{order.trackingCode}</span>
                {order.trackingUrl ? (
                  <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="ms-2 text-link hover:underline">پیگیری مرسوله</a>
                ) : null}
              </p>
            ) : null}
            {order.customerNote ? <p className="border-t pt-2 text-muted-foreground">توضیحات: {order.customerNote}</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
