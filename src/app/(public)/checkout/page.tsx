import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { OrderSummary } from "@/components/cart/order-summary";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { getCartView } from "@/features/cart/queries";
import { getPaymentProvider } from "@/features/payments";
import { isSalesOpen } from "@/features/settings/sales";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "ثبت سفارش", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <Container className="py-8 sm:py-12">
      <h1 className="mb-6 text-3xl font-black">ثبت سفارش</h1>
      <Suspense fallback={<LoadingRows rows={5} />}>
        <CheckoutContent />
      </Suspense>
    </Container>
  );
}

async function CheckoutContent() {
  const user = await requireUser("/checkout");
  if (!(await isSalesOpen())) {
    return <EmptyState icon={ShoppingCart} title="فروش آنلاین به‌زودی فعال می‌شود" />;
  }
  const cart = await getCartView(user.id);
  if (cart.lines.length === 0) {
    return <EmptyState icon={ShoppingCart} title="سبد خرید شما خالی است" action={<Button asChild><Link href="/shop">رفتن به فروشگاه</Link></Button>} />;
  }
  if (!cart.orderable) redirect("/cart");
  const addresses = await db.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: { id: true, recipientName: true, phone: true, province: true, city: true, postalCode: true, line: true, isDefault: true },
  });
  const provider = getPaymentProvider()!;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <CheckoutForm addresses={addresses} userName={user.name} userPhone={user.phone} payLabel={`پرداخت (${provider.label})`} />
      <div className="lg:sticky lg:top-24 lg:self-start">
        <OrderSummary subtotal={cart.subtotal} shipping={cart.shipping} total={cart.total}>
          <ul className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
            {cart.lines.map((l) => (
              <li key={l.id} className="flex justify-between gap-2"><span className="truncate">{l.title}</span><span>× {formatNumber(l.quantity)}</span></li>
            ))}
          </ul>
        </OrderSummary>
      </div>
    </div>
  );
}
